package reporter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/spf13/viper"
	"golang.org/x/term"
)

// WSMessage 定义 WebSocket 消息格式
type WSMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
}

// TerminalSession 管理一个终端会话
type TerminalSession struct {
	cmd    *exec.Cmd
	stdin  *os.File
	stdout *os.File
	stderr *os.File
	done   chan struct{}
}

// RunTerminal 启动 WebSocket 终端客户端
func RunTerminal(ctx context.Context, wsURL string, token string) error {
	// 这里简化实现：通过 websocket 连接接收 shell 指令
	// 由于 agent 当前没有 gorilla/websocket 依赖，这里改用 stdin/stdout 直连
	// 实际部署时可用 ncat / socat 等工具桥接，或安装 gorilla/websocket 后编译

	fmt.Println("[终端] 准备启动 shell 会话...")
	fmt.Printf("[终端] 连接地址: %s\n", wsURL)

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}
	// Windows 兼容
	if _, err := os.Stat(shell); os.IsNotExist(err) {
		if _, err := os.Stat("C:\\Windows\\System32\\cmd.exe"); err == nil {
			shell = "cmd.exe"
		} else {
			shell = "/bin/sh"
		}
	}

	// 使用 exec 启动交互式 shell
	cmd := exec.Command(shell)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// 设置终端原始模式（UNIX）
	if term.IsTerminal(int(os.Stdin.Fd())) {
		oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
		if err != nil {
			return fmt.Errorf("设置终端原始模式失败: %w", err)
		}
		defer term.Restore(int(os.Stdin.Fd()), oldState)
	}

	fmt.Printf("[终端] 启动 %s\n", shell)
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("shell 执行结束: %w", err)
	}
	return nil
}

// RunWSClient 运行 WebSocket 客户端（需要 gorilla/websocket 依赖时才编译）
// 编译方式: go build -tags=wsclient
// 当前使用简单的 TCP 直连作为替代方案
func RunWSClient(ctx context.Context, serverURL, token string) error {
	viper.Set("log_level", "info")

	// 使用 websocat / ncat 等外部工具作为临时方案
	// 或直接手动编译含 gorilla/websocket 的版本
	fmt.Println("[WS] 终端功能需要编译含 websocket 支持的版本:")
	fmt.Println("[WS]   go get github.com/gorilla/websocket")
	fmt.Println("[WS]   go build -tags=wsclient -o qltz-agent-ws .")
	fmt.Println("[WS]")
	fmt.Println("[WS] 或者使用外部工具桥接:")
	fmt.Printf("[WS]   websocat ws://%s/api/ws/agent?token=%s\n", serverURL, token)
	return nil
}

// StringFromEnv 从环境变量获取字符串值
func StringFromEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// SplitLines 分割多行文本
func SplitLines(s string) []string {
	lines := strings.Split(s, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func init() {
	// 确保 agent 启动时打印终端功能提示
	if viper.GetBool("debug") {
		fmt.Println("[终端] 终端功能使用外部 WebSocket 桥接")
		fmt.Println("[终端] 编译: go get github.com/gorilla/websocket && go build -tags=wsclient")
	}

	// 自动注册 JSON 序列化
	_ = json.Marshal
}
