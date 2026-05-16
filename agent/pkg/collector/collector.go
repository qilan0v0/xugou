package collector

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Version is set via ldflags at build time
var Version = "0.1.0"

// SystemInfo 包含系统的各种信息
type SystemInfo struct {
	Timestamp   time.Time     `json:"timestamp"`
	Hostname    string        `json:"hostname"`
	Platform    string        `json:"platform"`
	OS          string        `json:"os"`
	Version     string        `json:"version"` // 操作系统版本
	CPUInfo     CPUInfo       `json:"cpu"`
	MemoryInfo  MemoryInfo    `json:"memory"`
	DiskInfo    []DiskInfo    `json:"disks"`
	NetworkInfo []NetworkInfo `json:"network"`
	LoadInfo    LoadInfo      `json:"load"`
	BootTime     time.Time     `json:"boot_time"`
	AgentVersion string        `json:"agent_version"`
}

// CPUInfo 包含CPU相关信息
type CPUInfo struct {
	Usage       float64 `json:"usage"`
	Cores       int     `json:"cores"`
	ModelName   string  `json:"model_name"`
	Arch        string  `json:"arch"`
	Temperature float64 `json:"temperature,omitempty"`
}

// MemoryInfo 包含内存相关信息
type MemoryInfo struct {
	Total     uint64  `json:"total"`
	Used      uint64  `json:"used"`
	Free      uint64  `json:"free"`
	UsageRate float64 `json:"usage_rate"`
}

// DiskInfo 包含磁盘相关信息
type DiskInfo struct {
	Device     string  `json:"device"`
	MountPoint string  `json:"mount_point"`
	Total      uint64  `json:"total"`
	Used       uint64  `json:"used"`
	Free       uint64  `json:"free"`
	UsageRate  float64 `json:"usage_rate"`
	FSType     string  `json:"fs_type"`
}

// NetworkInfo 包含网络相关信息
type NetworkInfo struct {
	Interface   string `json:"interface"`
	BytesSent   uint64 `json:"bytes_sent"`
	BytesRecv   uint64 `json:"bytes_recv"`
	PacketsSent uint64 `json:"packets_sent"`
	PacketsRecv uint64 `json:"packets_recv"`
}

// LoadInfo 包含系统负载信息
type LoadInfo struct {
	Load1  float64 `json:"load1"`
	Load5  float64 `json:"load5"`
	Load15 float64 `json:"load15"`
}

// Collector 定义数据收集器接口
type Collector interface {
	Collect(ctx context.Context) (*SystemInfo, error)
}

// DefaultCollector 是默认的数据收集器实现
type DefaultCollector struct{}

// NewCollector 创建一个新的数据收集器
func NewCollector() Collector {
	return &DefaultCollector{}
}

// Collect 收集系统信息
func (c *DefaultCollector) Collect(ctx context.Context) (*SystemInfo, error) {
	info := &SystemInfo{
		Timestamp: time.Now(),
	}

	// 获取主机信息
	hostInfo, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("获取主机信息失败: %w", err)
	}
	info.Hostname = hostInfo.Hostname
	info.Platform = hostInfo.Platform
	info.OS = hostInfo.OS
	// 设置操作系统版本，格式化为更有意义的信息
	info.Version = fmt.Sprintf("%s %s (%s)", hostInfo.Platform, hostInfo.PlatformVersion, hostInfo.KernelVersion)

	// 获取CPU信息
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		return nil, fmt.Errorf("获取CPU使用率失败: %w", err)
	}

	cpuInfo, err := cpu.Info()
	if err != nil {
		return nil, fmt.Errorf("获取CPU信息失败: %w", err)
	}

	var modelName string
	if len(cpuInfo) > 0 {
		modelName = cpuInfo[0].ModelName
	}

	info.CPUInfo = CPUInfo{
		Usage:     cpuPercent[0],
		Cores:     runtime.NumCPU(),
		ModelName: modelName,
		Arch:      runtime.GOARCH,
	}

	// 获取内存信息
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("获取内存信息失败: %w", err)
	}

	info.MemoryInfo = MemoryInfo{
		Total:     memInfo.Total,
		Used:      memInfo.Used,
		Free:      memInfo.Free,
		UsageRate: memInfo.UsedPercent,
	}

	// 获取磁盘信息
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, fmt.Errorf("获取磁盘分区信息失败: %w", err)
	}

	for _, partition := range partitions {
		usage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			continue
		}

		diskInfo := DiskInfo{
			Device:     partition.Device,
			MountPoint: partition.Mountpoint,
			Total:      usage.Total,
			Used:       usage.Used,
			Free:       usage.Free,
			UsageRate:  usage.UsedPercent,
			FSType:     partition.Fstype,
		}
		info.DiskInfo = append(info.DiskInfo, diskInfo)
	}

	// 获取网络信息
	netIOCounters, err := net.IOCounters(true)
	if err != nil {
		return nil, fmt.Errorf("获取网络信息失败: %w", err)
	}

	for _, netIO := range netIOCounters {
		networkInfo := NetworkInfo{
			Interface:   netIO.Name,
			BytesSent:   netIO.BytesSent,
			BytesRecv:   netIO.BytesRecv,
			PacketsSent: netIO.PacketsSent,
			PacketsRecv: netIO.PacketsRecv,
		}
		info.NetworkInfo = append(info.NetworkInfo, networkInfo)
	}

	// 获取系统负载
	loadAvg, err := load.Avg()
	if err == nil {
		info.LoadInfo = LoadInfo{
			Load1:  loadAvg.Load1,
			Load5:  loadAvg.Load5,
			Load15: loadAvg.Load15,
		}
	}

	// 获取系统启动时间
	bootTime, err := host.BootTime()
	if err == nil {
		info.BootTime = time.Unix(int64(bootTime), 0)
	}

	// 设置 Agent 版本（从编译时 ldflags 注入）
	info.AgentVersion = Version

	return info, nil
}
