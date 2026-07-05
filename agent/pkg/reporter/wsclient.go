package reporter

import (
	"bufio"
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

	"github.com/gorilla/websocket"
	"github.com/spf13/viper"
)

// WSMessage 定义 WebSocket 消息格式
type WSMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
	Code int    `json:"code,omitempty"`
}

// TerminalSession 管理一个终端会话
type TerminalSession struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	done   chan struct{}
	mu     sync.Mutex
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
				fmt.Printf("[WS] 连接失败: %v，5秒后重试\n", err)
			}
			time.Sleep(5 * time.Second)
			continue
		}

		if viper.GetBool("debug") {
			fmt.Println("[WS] 已连接")
		}

		// ping 保活
		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					conn.WriteMessage(websocket.PingMessage, nil)
				case <-done:
					return
				case <-ctx.Done():
					return
				}
			}
		}()

		// 消息处理
		err = func() error {
			for {
				_, message, err := conn.ReadMessage()
				if err != nil {
					return err
				}

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
					// pty resize - 暂不实现
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
			time.Sleep(3 * time.Second)
		}
	}
}

func sendWS(conn *websocket.Conn, msg WSMessage) {
	data, _ := json.Marshal(msg)
	conn.WriteMessage(websocket.TextMessage, data)
}

// NewTerminalSession 创建终端会话
func NewTerminalSession() *TerminalSession {
	return &TerminalSession{done: make(chan struct{})}
}

// Run 启动 shell，读取输出并通过回调返回
func (s *TerminalSession) Run(onOutput func(string, int)) {
	s.mu.Lock()

	shell := "/bin/sh"
	if runtime.GOOS == "windows" {
		shell = "cmd.exe"
	}
	if env := os.Getenv("SHELL"); env != "" {
		shell = env
	}

	cmd := exec.Command(shell)
	stdin, _ := cmd.StdinPipe()
	stdout, _ := cmd.StdoutPipe()
	cmd.Stderr = cmd.Stdout // stderr 合并到 stdout

	s.cmd = cmd
	s.stdin = stdin
	s.mu.Unlock()

	if err := cmd.Start(); err != nil {
		onOutput(fmt.Sprintf("shell error: %v\n", err), 1)
		return
	}

	// 实时读取输出
	go func() {
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 64*1024), 64*1024)
		for scanner.Scan() {
			onOutput(scanner.Text()+"\r\n", -1)
		}
	}()

	// 等待 done 信号关闭 stdin
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
}

// Write 向 shell 写入输入
func (s *TerminalSession) Write(data string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stdin != nil {
		io.WriteString(s.stdin, data)
	}
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
	if s.cmd != nil && s.cmd.Process != nil {
		s.cmd.Process.Kill()
	}
}
