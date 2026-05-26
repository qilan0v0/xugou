package agent

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

func init() {
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "配置 Qltz Agent",
		Long:  `配置 Qltz Agent 的服务器地址、API 令牌等设置`,
		Run:   runConfig,
	}

	rootCmd.AddCommand(configCmd)
}

func runConfig(cmd *cobra.Command, args []string) {
	// 获取当前配置
	server := viper.GetString("server")
	token := viper.GetString("uuid")
	interval := viper.GetInt("interval")
	logLevel := viper.GetString("log_level")

	// 创建配置结构
	config := map[string]interface{}{
		"server":    server,
		"uuid":      token,
		"interval":  interval,
		"log_level": logLevel,
	}

	// 确定配置文件路径
	configPath := cfgFile
	if configPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			fmt.Println("错误: 无法获取用户主目录:", err)
			os.Exit(1)
		}
		configPath = filepath.Join(home, ".qltz-agent.yaml")
	}

	// 将配置写入文件
	data, err := yaml.Marshal(config)
	if err != nil {
		fmt.Println("错误: 无法序列化配置:", err)
		os.Exit(1)
	}

	err = os.WriteFile(configPath, data, 0644)
	if err != nil {
		fmt.Println("错误: 无法写入配置文件:", err)
		os.Exit(1)
	}

	fmt.Println("配置已保存到:", configPath)
	fmt.Println("当前配置:")
	fmt.Printf("  服务器地址: %s\n", server)
	fmt.Printf("  API 令牌: %s\n", maskToken(token))
	fmt.Printf("  收集间隔: %d秒\n", interval)
	fmt.Printf("  日志级别: %s\n", logLevel)
}

// maskToken 对令牌进行掩码处理，只显示前4位和后4位
func maskToken(token string) string {
	if len(token) <= 8 {
		return token
	}
	return token[:4] + "..." + token[len(token)-4:]
}
