package agent

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/xugou/agent/pkg/collector"
	"github.com/xugou/agent/pkg/reporter"
)

func init() {
	startCmd := &cobra.Command{
		Use:   "start",
		Short: "启动 Xugou Agent",
		Long:  `启动 Xugou Agent 开始收集系统信息并上报到服务器`,
		Run:   runStart,
	}

	startCmd.Flags().IntP("interval", "i", 60, "数据收集和上报间隔（秒）")
	viper.BindPFlag("interval", startCmd.Flags().Lookup("interval"))

	rootCmd.AddCommand(startCmd)
}

func runStart(cmd *cobra.Command, args []string) {
	// 检查必要的配置
	token := viper.GetString("token")
	server := viper.GetString("server")
	interval := viper.GetInt("interval")

	if token == "" {
		fmt.Println("错误: 未设置 API 令牌，请使用 --token 参数或在配置文件中设置")
		os.Exit(1)
	}

	if server == "" {
		fmt.Println("错误: 未设置服务器地址，请使用 --server 参数或在配置文件中设置")
		os.Exit(1)
	}

	if viper.GetBool("debug") { fmt.Println("Xugou Agent 启动中...") }
	if viper.GetBool("debug") { fmt.Printf("服务器地址: %s\n", server) }
	fmt.Printf("收集间隔: %d秒\n", interval)
	if viper.GetBool("debug") { fmt.Println("使用令牌自动注册/上报数据") }

	// 设置上下文，用于处理取消信号
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 初始化数据收集器和上报器
	dataCollector := collector.NewCollector()
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
