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
		Use:   "xugou-agent",
		Short: "Xugou Agent - 系统监控客户端",
		Long: `Xugou Agent 是一个系统监控客户端，用于收集系统信息并上报到监控服务器。
它可以收集 CPU、内存、磁盘、网络等系统信息，并定期上报到指定的服务器。`,
	}
)

// Execute 执行根命令
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "配置文件路径 (默认为 $HOME/.xugou-agent.yaml)")
	rootCmd.PersistentFlags().String("server", "", "监控服务器地址")
	rootCmd.PersistentFlags().String("token", "", "API 令牌")
	rootCmd.PersistentFlags().String("log-level", "info", "日志级别 (debug, info, warn, error)")
	rootCmd.PersistentFlags().Int("agent-id", 0, "客户端 ID，需要与服务器中注册的 ID 一致")

	viper.BindPFlag("server", rootCmd.PersistentFlags().Lookup("server"))
	viper.BindPFlag("token", rootCmd.PersistentFlags().Lookup("token"))
	viper.BindPFlag("log_level", rootCmd.PersistentFlags().Lookup("log-level"))
	viper.BindPFlag("agent_id", rootCmd.PersistentFlags().Lookup("agent-id"))
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

		// 在主目录中查找 .xugou-agent.yaml 文件
		viper.AddConfigPath(home)
		viper.SetConfigName(".xugou-agent")
		viper.SetConfigType("yaml")
		cfgFile = filepath.Join(home, ".xugou-agent.yaml")
	}

	// 读取环境变量
	viper.AutomaticEnv()
	viper.SetEnvPrefix("XUGOU")

	// 如果找到配置文件，则读取它
	if err := viper.ReadInConfig(); err == nil {
		fmt.Println("使用配置文件:", viper.ConfigFileUsed())
	} else {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Println("警告: 配置文件读取错误:", err)
		}
	}
}
