package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	agent "github.com/xugou/agent/cmd/agent"
	"github.com/xugou/agent/pkg/collector"
)

// Reporter 定义数据上报器接口
type Reporter interface {
	Report(ctx context.Context, info *collector.SystemInfo) error
}

// HTTPReporter 是基于HTTP的数据上报器实现
type HTTPReporter struct {
	serverURL      string
	apiToken       string
	client         *http.Client
	lastNetworkRX  uint64    // 上次网络接收字节数
	lastNetworkTX  uint64    // 上次网络发送字节数
	lastUpdateTime time.Time // 上次更新时间
	registered     bool      // 是否已注册
}

// NewHTTPReporter 创建一个新的HTTP数据上报器
func NewHTTPReporter(serverURL, apiToken string) Reporter {
	return &HTTPReporter{
		serverURL: serverURL,
		apiToken:  apiToken,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		lastUpdateTime: time.Now(),
		registered:     false,
	}
}

// StatusPayload 定义上报到后端的数据结构（包含 flat + nested 字段）
type StatusPayload struct {
	Token        string              `json:"token"`
	CPUUsage     float64             `json:"cpu_usage"`
	MemoryTotal  uint64              `json:"memory_total"`
	MemoryUsed   uint64              `json:"memory_used"`
	DiskTotal    uint64              `json:"disk_total"`
	DiskUsed     uint64              `json:"disk_used"`
	NetworkRX    uint64              `json:"network_rx"`
	NetworkTX    uint64              `json:"network_tx"`
	Hostname     string              `json:"hostname"`
	IPAddresses  []string            `json:"ip_addresses"`
	IPAddress    string              `json:"ip_address"`
	OS           string              `json:"os"`
	Version      string              `json:"version"`
	CPU          collector.CPUInfo   `json:"cpu"`
	Memory       collector.MemoryInfo `json:"memory"`
	Disks        []collector.DiskInfo `json:"disks"`
	Network      []collector.NetworkInfo `json:"network"`
	Load         collector.LoadInfo  `json:"load"`
	BootTime     string              `json:"boot_time"`
	AgentVersion string              `json:"agent_version"`
	Keepalive    int                 `json:"keepalive"`
}

// RegisterPayload 定义注册到后端的数据结构
type RegisterPayload struct {
	Token     string `json:"token"`      // API令牌
	Name      string `json:"name"`       // 客户端名称
	Hostname  string `json:"hostname"`   // 主机名
	IPAddress string `json:"ip_address"` // IP地址
	OS        string `json:"os"`         // 操作系统
	Version   string `json:"version"`    // 操作系统版本
}

// RegisterResponse 定义注册响应结构
type RegisterResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Agent   struct {
		ID int `json:"id"`
	} `json:"agent"`
}

// ensureRegistered 确保客户端已经在服务器端注册
func (r *HTTPReporter) ensureRegistered(ctx context.Context, info *collector.SystemInfo) error {
	if r.registered {
		return nil
	}

	// 构建注册的数据结构
	payload := RegisterPayload{
		Token:     r.apiToken,
		Name:      info.Hostname,
		Hostname:  info.Hostname,
		IPAddress: getLocalIP(),
		OS:        info.OS,
		Version:   info.Version,
	}

	// 将数据转换为JSON
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("序列化注册信息失败: %w", err)
	}

	// 构建注册URL
	url := fmt.Sprintf("%s/api/agents/register", r.serverURL)

	// 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("创建注册HTTP请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "XUGOU-Agent/1.0")

	// 发送请求
	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("发送注册HTTP请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态码
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("服务器返回错误状态码: %d", resp.StatusCode)
	}

	// 解析响应
	var response RegisterResponse
	decoder := json.NewDecoder(resp.Body)
	if err := decoder.Decode(&response); err != nil {
		return fmt.Errorf("解析注册响应失败: %w", err)
	}

	if !response.Success {
		return fmt.Errorf("注册失败: %s", response.Message)
	}

	// 根据响应消息区分是新注册还是状态更新
	if response.Message == "客户端状态更新成功" {
		fmt.Printf("客户端状态更新成功，通过Token: %s\n", r.apiToken)
	} else {
		fmt.Printf("客户端注册成功，通过Token: %s\n", r.apiToken)
	}

	r.registered = true
	return nil
}

// Report 将系统信息上报到服务器
func (r *HTTPReporter) Report(ctx context.Context, info *collector.SystemInfo) error {
	// 确保客户端已注册
	if err := r.ensureRegistered(ctx, info); err != nil {
		return fmt.Errorf("客户端注册或状态更新失败: %w", err)
	}

	// 提取所有磁盘的总容量和使用量
	var diskTotal, diskUsed uint64
	for _, disk := range info.DiskInfo {
		diskTotal += disk.Total
		diskUsed += disk.Used
	}

	// 提取网络传输数据（简单汇总所有网络接口）
	var currentNetworkRX, currentNetworkTX uint64
	for _, net := range info.NetworkInfo {
		currentNetworkRX += net.BytesRecv
		currentNetworkTX += net.BytesSent
	}

	// 计算网络流量速率（KB/s）
	now := time.Now()
	var networkRXRate, networkTXRate float64

	if !r.lastUpdateTime.IsZero() {
		timeDiff := now.Sub(r.lastUpdateTime).Seconds()
		if timeDiff > 0 {
			networkRXRate = float64(currentNetworkRX-r.lastNetworkRX) / timeDiff / 1024 // 转换为KB/s
			networkTXRate = float64(currentNetworkTX-r.lastNetworkTX) / timeDiff / 1024 // 转换为KB/s
		}
	}

	// 更新历史数据
	r.lastNetworkRX = currentNetworkRX
	r.lastNetworkTX = currentNetworkTX
	r.lastUpdateTime = now

	// 构建上报的数据结构（flat + nested 字段，兼容后端 DIRECT handler 提取）
	bootTimeStr := ""
	if !info.BootTime.IsZero() {
		bootTimeStr = info.BootTime.Format(time.RFC3339)
	}
	localIP := getLocalIP()
	payload := StatusPayload{
		Token:        r.apiToken,
		CPUUsage:     info.CPUInfo.Usage,
		MemoryTotal:  info.MemoryInfo.Total / 1024,
		MemoryUsed:   info.MemoryInfo.Used / 1024,
		DiskTotal:    diskTotal / 1024,
		DiskUsed:     diskUsed / 1024,
		NetworkRX:    uint64(networkRXRate),
		NetworkTX:    uint64(networkTXRate),
		Hostname:     info.Hostname,
		IPAddresses:  []string{localIP},
		IPAddress:    localIP,
		OS:           info.OS,
		Version:      info.Version,
		CPU:          info.CPUInfo,
		Memory:       info.MemoryInfo,
		Disks:        info.DiskInfo,
		Network:      info.NetworkInfo,
		Load:         info.LoadInfo,
		BootTime:     bootTimeStr,
		AgentVersion: collector.Version,
		Keepalive:    30,
	}

	// 将数据转换为JSON
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("序列化系统信息失败: %w", err)
	}

	// 构建请求URL - 使用新的基于token的API
	url := fmt.Sprintf("%s/api/agents/status", r.serverURL)

	// 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("创建HTTP请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "XUGOU-Agent/1.0")

	// 发送请求
	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("发送HTTP请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态码
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("服务器返回错误状态码: %d", resp.StatusCode)
	}

	fmt.Printf("成功上报数据到服务器，token: %s, CPU: %.2f%%, 内存: %.2f%%, 硬盘: %.2f%%, 网络下载: %.2f KB/s, 网络上传: %.2f KB/s\n",
		r.apiToken,
		payload.CPUUsage,
		float64(payload.MemoryUsed)/float64(payload.MemoryTotal)*100,
		float64(payload.DiskUsed)/float64(payload.DiskTotal)*100,
		float64(payload.NetworkRX),
		float64(payload.NetworkTX))

	return nil
}

// ConsoleReporter 是将数据输出到控制台的上报器实现
type ConsoleReporter struct{}

// NewConsoleReporter 创建一个新的控制台数据上报器
func NewConsoleReporter() Reporter {
	return &ConsoleReporter{}
}

// Report 将系统信息输出到控制台
func (r *ConsoleReporter) Report(ctx context.Context, info *collector.SystemInfo) error {
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化系统信息失败: %w", err)
	}

	fmt.Println("系统信息收集时间:", info.Timestamp.Format("2006-01-02 15:04:05"))
	fmt.Println("主机名:", info.Hostname)
	fmt.Println("平台:", info.Platform, info.OS)
	fmt.Println("CPU使用率:", info.CPUInfo.Usage, "%")
	fmt.Println("内存使用率:", info.MemoryInfo.UsageRate, "%")
	fmt.Println("系统负载:", info.LoadInfo.Load1, info.LoadInfo.Load5, info.LoadInfo.Load15)
	fmt.Println("详细信息:")
	fmt.Println(string(data))

	return nil
}

// getLocalIP 获取本地IP地址
func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "未知"
	}

	for _, addr := range addrs {
		// 检查IP地址类型
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}

	return "未知"
}
