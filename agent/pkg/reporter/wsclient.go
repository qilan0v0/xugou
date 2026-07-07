package reporter

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
	"github.com/spf13/viper"
)

// WSMessage 定义 WebSocket 消息格式
type WSMessage struct {
	Type   string `json:"type"`
	Data   string `json:"data,omitempty"`
	Cols   int    `json:"cols,omitempty"`
	Rows   int    `json:"rows,omitempty"`
	Code   int    `json:"code,omitempty"`
	Offset int    `json:"offset,omitempty"`
	Length int    `json:"length,omitempty"`
	Path   string `json:"path,omitempty"`
}

// TerminalSession 管理一个终端会话
type TerminalSession struct {
	cmd      *exec.Cmd
	ptyFile  *os.File // PTY master（非 Windows）；Windows 走 stdin pipe
	stdin    io.WriteCloser
	done     chan struct{}
	mu       sync.Mutex
}

// RunWSClient 启动 WebSocket 客户端，保持长连接并处理终端指令
func RunWSClient(ctx context.Context, serverURL, token string) {
	wsBase := strings.Replace(serverURL, "http://", "ws://", 1)
	wsBase = strings.Replace(wsBase, "https://", "wss://", 1)
	wsURL := fmt.Sprintf("%s/api/ws/agent?token=%s", wsBase, token)

	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	var currentSession *TerminalSession

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if viper.GetBool("debug") {
			fmt.Printf("[WS] 连接 %s\n", wsURL)
		}

		conn, _, err := dialer.Dial(wsURL, nil)
		if err != nil {
			if viper.GetBool("debug") {
				fmt.Printf("[WS] 连接失败: %v，3秒后重试\n", err)
			}
			time.Sleep(3 * time.Second)
			continue
		}

		// 设置 pong 处理，保持连接活跃
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		if viper.GetBool("debug") {
			fmt.Println("[WS] 已连接")
		}

		// ping 保活 goroutine
		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(25 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				case <-done:
					return
				case <-ctx.Done():
					return
				}
			}
		}()

		// 消息处理循环
		err = func() error {
			for {
				_, message, err := conn.ReadMessage()
				if err != nil {
					return err
				}
				// 重置读超时
				conn.SetReadDeadline(time.Now().Add(60 * time.Second))

				var msg WSMessage
				if err := json.Unmarshal(message, &msg); err != nil {
					continue
				}

				switch msg.Type {
				case "shell-start":
					if currentSession != nil {
						currentSession.Close()
					}
					s := NewTerminalSession()
					currentSession = s
					// 默认尺寸 80×24，前端连上后会发 resize 覆盖
					s.Resize(80, 24)
					go s.Run(func(output string, exitCode int) {
						sendWS(conn, WSMessage{Type: "shell-output", Data: output})
						if exitCode >= 0 {
							sendWS(conn, WSMessage{Type: "shell-exit", Code: exitCode})
						}
					})

				case "shell-input":
					if currentSession != nil {
						currentSession.Write(msg.Data)
					}

				case "shell-end":
					if currentSession != nil {
						currentSession.Close()
						currentSession = nil
					}

				case "resize":
					if currentSession != nil {
						currentSession.Resize(msg.Cols, msg.Rows)
					}

				default:
					// 文件操作
					if resp := HandleFileOps(msg); resp != nil {
						sendWS(conn, *resp)
					}
				}
			}
		}()

		close(done)
		conn.Close()

		if currentSession != nil {
			currentSession.Close()
			currentSession = nil
		}

		select {
		case <-ctx.Done():
			return
		default:
			time.Sleep(1 * time.Second) // 断开后快速重连
		}
	}
}

var wsWriteMu sync.Mutex

func sendWS(conn *websocket.Conn, msg WSMessage) {
	data, _ := json.Marshal(msg)
	wsWriteMu.Lock()
	conn.WriteMessage(websocket.TextMessage, data)
	wsWriteMu.Unlock()
}

// NewTerminalSession 创建终端会话
func NewTerminalSession() *TerminalSession {
	return &TerminalSession{done: make(chan struct{})}
}

// Run 启动 shell，读取输出并通过回调返回
func (s *TerminalSession) Run(onOutput func(string, int)) {
	s.mu.Lock()

	shell := "/bin/sh"
	var shellArgs []string
	if runtime.GOOS == "windows" {
		shell = "cmd.exe"
	} else {
		shellArgs = []string{"-i"}
	}
	if env := os.Getenv("SHELL"); env != "" {
		shell = env
	}

	cmd := exec.Command(shell, shellArgs...)
	// 设置终端类型，让 shell 正确解析方向键/退格等控制序列
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	if runtime.GOOS == "windows" {
		// Windows 不支持 PTY，走原管道 fallback
		stdin, _ := cmd.StdinPipe()
		stdout, _ := cmd.StdoutPipe()
		cmd.Stderr = cmd.Stdout

		s.cmd = cmd
		s.stdin = stdin
		s.mu.Unlock()

		if err := cmd.Start(); err != nil {
			onOutput(fmt.Sprintf("shell error: %v\n", err), 1)
			return
		}

		go func() {
			buf := make([]byte, 32*1024)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					onOutput(string(buf[:n]), -1)
				}
				if err != nil {
					return
				}
			}
		}()

		go func() {
			<-s.done
			stdin.Close()
		}()

		err := cmd.Wait()
		exitCode := 0
		if err != nil {
			if e, ok := err.(*exec.ExitError); ok {
				exitCode = e.ExitCode()
			} else {
				exitCode = 1
			}
		}
		onOutput("", exitCode)
		return
	}

	// 非 Windows：用 PTY 启动 shell，获得回显、提示符、行编辑、控制序列
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		s.mu.Unlock()
		onOutput(fmt.Sprintf("shell error: %v\n", err), 1)
		return
	}

	s.cmd = cmd
	s.ptyFile = ptyFile
	s.mu.Unlock()

	// 原始字节读取 PTY master，不按行扫描、不重写换行
	go func() {
		buf := make([]byte, 32*1024)
		for {
			n, err := ptyFile.Read(buf)
			if n > 0 {
				onOutput(string(buf[:n]), -1)
			}
			if err != nil {
				return
			}
		}
	}()

	go func() {
		<-s.done
		ptyFile.Close()
	}()

	err = cmd.Wait()
	exitCode := 0
	if err != nil {
		if e, ok := err.(*exec.ExitError); ok {
			exitCode = e.ExitCode()
		} else {
			exitCode = 1
		}
	}
	onOutput("", exitCode)
}

// Write 向 shell 写入输入
func (s *TerminalSession) Write(data string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ptyFile != nil {
		io.WriteString(s.ptyFile, data)
	} else if s.stdin != nil {
		io.WriteString(s.stdin, data)
	}
}

// Resize 调整 PTY 尺寸
func (s *TerminalSession) Resize(cols, rows int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ptyFile == nil || cols <= 0 || rows <= 0 {
		return
	}
	_ = pty.Setsize(s.ptyFile, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
}

// Close 关闭会话
func (s *TerminalSession) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case <-s.done:
	default:
		close(s.done)
	}
	if s.ptyFile != nil {
		s.ptyFile.Close()
	}
	if s.cmd != nil && s.cmd.Process != nil {
		s.cmd.Process.Kill()
	}
}
