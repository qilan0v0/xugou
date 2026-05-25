package agent

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/xugou/agent/pkg/collector"
	"github.com/xugou/agent/pkg/reporter"
	"gopkg.in/yaml.v3"
)

func init() {
	startCmd := &cobra.Command{
		Use:   "start",
		Short: "启动 Xugou Agent",
		Long:  `启动 Xugou Agent 开始收集系统信息并上报到服务器`,
		Run:   runStart,
	}

	startCmd.Flags().IntP("interval", "i", 60, "数据收集和上报间隔（秒）")
	startCmd.Flags().Int("report-delay", 0, "Nezha 兼容: 同 --interval")
	viper.BindPFlag("interval", startCmd.Flags().Lookup("interval"))
	viper.BindPFlag("report_delay", startCmd.Flags().Lookup("report-delay"))

	rootCmd.AddCommand(startCmd)
}

func hasScheme(u string) bool {
	return len(u) >= 7 && (u[:7] == "http://" || u[:8] == "https://" || u[:6] == "wss://" || u[:5] == "ws://")
}

// generateUUID generates a random UUID v4 without external dependencies
func generateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		// fallback: use timestamp-based pseudo-random
		for i := range b {
			b[i] = byte(time.Now().UnixNano()>>((i%8)*8)) ^ byte(i*37)
		}
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// saveToken persists the token to config file
func saveToken(token string) {
	configPath := cfgFile
	if configPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return
		}
		configPath = filepath.Join(home, ".xugou-agent.yaml")
	}

	config := map[string]interface{}{
		"server":    viper.GetString("server"),
		"uuid":      token,
		"interval":  viper.GetInt("interval"),
		"log_level": viper.GetString("log_level"),
	}
	data, err := yaml.Marshal(config)
	if err != nil {
		return
	}
	os.WriteFile(configPath, data, 0644)
}

func runStart(cmd *cobra.Command, args []string) {
	// 检查必要的配置
	token := viper.GetString("uuid")
	if token == "" {
		token = viper.GetString("password") // nezha compat: -p / --password
	}
	server := viper.GetString("server")
	if server != "" && viper.GetBool("tls") && !hasScheme(server) {
		server = "https://" + server
	}
	// nezha compat: --report-delay overrides --interval
	interval := viper.GetInt("interval")
	if rd := viper.GetInt("report_delay"); rd > 0 {
		interval = rd
	}
	// nezha compat: -d / --debug sets log-level=debug
	if viper.GetBool("debug") {
		viper.Set("log_level", "debug")
	}

	if token == "" {
		token = generateUUID()
		viper.Set("uuid", token)
		saveToken(token)
		fmt.Printf("已自动生成 UUID Token: %s (已保存到配置文件)\n", token)
	}

	if server == "" {
		fmt.Println("错误: 未设置服务器地址，请使用 -s 参数或在配置文件中设置")
		os.Exit(1)
	}

	debug := viper.GetString("log_level") == "debug"
	skipConn := viper.GetBool("skip_conn")
	skipProcs := viper.GetBool("skip_procs")
	if debug { fmt.Println("Xugou Agent 启动中...") }
	if debug { fmt.Printf("服务器地址: %s\n", server) }
	if debug { fmt.Printf("收集间隔: %d秒\n", interval) }
	if debug && skipConn { fmt.Println("跳过连接数统计") }
	if debug && skipProcs { fmt.Println("跳过进程数统计") }
	if debug { fmt.Println("使用令牌自动注册/上报数据") }

	// 设置上下文，用于处理取消信号
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 初始化数据收集器和上报器
	dataCollector := collector.NewCollector()
	dataCollector.SetSkipConn(skipConn)
	dataCollector.SetSkipProcs(skipProcs)
	var dataReporter reporter.Reporter

	// 根据配置决定使用哪种上报器
	if server == "console" {
		dataReporter = reporter.NewConsoleReporter()
		if viper.GetBool("debug") { fmt.Println("使用控制台上报器") }
	} else {
		dataReporter = reporter.NewHTTPReporter(server, token)
		if viper.GetBool("debug") { fmt.Println("使用HTTP上报器") }
	}

	// 设置定时器，按指定间隔收集和上报数据
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	// 设置信号处理，用于优雅退出
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// 启动时立即执行一次收集和上报
	go collectAndReport(ctx, dataCollector, dataReporter)

	if viper.GetBool("debug") { fmt.Println("Xugou Agent 已启动，按 Ctrl+C 停止") }

	// 主循环
	for {
		select {
		case <-ticker.C:
			go collectAndReport(ctx, dataCollector, dataReporter)
		case sig := <-sigCh:
			fmt.Printf("收到信号 %v，正在停止...\n", sig)
			return
		}
	}
}

// collectAndReport 收集并上报系统信息
func collectAndReport(ctx context.Context, c collector.Collector, r reporter.Reporter) {
	// 收集系统信息
	info, err := c.Collect(ctx)
	if err != nil {
		fmt.Printf("收集系统信息失败: %v\n", err)
		return
	}

	// 上报系统信息
	err = r.Report(ctx, info)
	if err != nil {
		fmt.Printf("上报系统信息失败: %v\n", err)
		return
	}

	if viper.GetBool("debug") { fmt.Printf("系统信息已收集并上报，时间: %s\n", info.Timestamp.Format("2006-01-02 15:04:05")) }
}
