package agent

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string
	rootCmd = &cobra.Command{
		Use:   "qltz-agent",
		Short: "Qltz Agent - 系统监控客户端",
		Long: `Qltz Agent 是一个系统监控客户端，用于收集系统信息并上报到监控服务器。
它可以收集 CPU、内存、磁盘、网络等系统信息，并定期上报到指定的服务器。`,
	}
)

// Execute 执行根命令
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "配置文件路径 (默认为 $HOME/.qltz-agent.yaml)")
	rootCmd.PersistentFlags().StringP("server", "s", "", "监控服务器地址")
	rootCmd.PersistentFlags().String("uuid", "", "API 令牌 (UUID 格式，不设置则自动生成)")
	rootCmd.PersistentFlags().StringP("password", "p", "", "Nezha 兼容: 同 --uuid")
	rootCmd.PersistentFlags().String("log-level", "info", "日志级别 (debug, info, warn, error)")
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Nezha 兼容: 开启 debug 日志")
	rootCmd.PersistentFlags().Bool("tls", false, "Nezha 兼容: 使用 TLS 连接")
	rootCmd.PersistentFlags().Int("agent-id", 0, "客户端 ID，需要与服务器中注册的 ID 一致")
	rootCmd.PersistentFlags().Bool("skip-conn", false, "Nezha 兼容: 跳过连接数统计")
	rootCmd.PersistentFlags().Bool("skip-procs", false, "Nezha 兼容: 跳过进程数统计")

	viper.BindPFlag("server", rootCmd.PersistentFlags().Lookup("server"))
	viper.BindPFlag("uuid", rootCmd.PersistentFlags().Lookup("uuid"))
	viper.BindPFlag("password", rootCmd.PersistentFlags().Lookup("password"))
	viper.BindPFlag("log_level", rootCmd.PersistentFlags().Lookup("log-level"))
	viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))
	viper.BindPFlag("tls", rootCmd.PersistentFlags().Lookup("tls"))
	viper.BindPFlag("agent_id", rootCmd.PersistentFlags().Lookup("agent-id"))
	viper.BindPFlag("skip_conn", rootCmd.PersistentFlags().Lookup("skip-conn"))
	viper.BindPFlag("skip_procs", rootCmd.PersistentFlags().Lookup("skip-procs"))
}

func initConfig() {
	if cfgFile != "" {
		// 使用指定的配置文件
		viper.SetConfigFile(cfgFile)
	} else {
		// 查找用户主目录
		home, err := os.UserHomeDir()
		if err != nil {
			fmt.Println("错误: 无法获取用户主目录:", err)
			os.Exit(1)
		}

		// 在主目录中查找 .qltz-agent.yaml 文件
		viper.AddConfigPath(home)
		viper.SetConfigName(".qltz-agent")
		viper.SetConfigType("yaml")
		cfgFile = filepath.Join(home, ".qltz-agent.yaml")
	}

	// 读取环境变量
	viper.AutomaticEnv()
	viper.SetEnvPrefix("QLTZ")

	// 如果找到配置文件，则读取它
	if err := viper.ReadInConfig(); err == nil {
		fmt.Println("使用配置文件:", viper.ConfigFileUsed())
	} else {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Println("警告: 配置文件读取错误:", err)
		}
	}

	// Nezha v1 config.yaml field mappings
	alias := func(from, to string) {
		if viper.IsSet(from) && !viper.IsSet(to) {
			viper.Set(to, viper.Get(from))
		}
	}
	alias("client_secret", "password")
	alias("report_delay", "interval")
	alias("skip_connection_count", "skip_conn")
	alias("skip_procs_count", "skip_procs")
	alias("insecure_tls", "tls_insecure")
}
