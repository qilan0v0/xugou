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
	"github.com/shirou/gopsutil/v3/process"
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
	ProcessCount int           `json:"process_count"`
	TcpCount     int           `json:"tcp_count"`
	UdpCount     int           `json:"udp_count"`
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
	SetSkipConn(skip bool)
	SetSkipProcs(skip bool)
}

// DefaultCollector 是默认的数据收集器实现
type DefaultCollector struct {
	skipConn  bool
	skipProcs bool
}

// NewCollector 创建一个新的数据收集器
func NewCollector() Collector {
	return &DefaultCollector{}
}

func (c *DefaultCollector) SetSkipConn(skip bool)  { c.skipConn = skip }
func (c *DefaultCollector) SetSkipProcs(skip bool) { c.skipProcs = skip }

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
	// 用 all=true 枚举，跳过伪/虚拟文件系统并按设备去重。
	// 容器（overlay 根、设备名非 /dev/*）用 all=false 会被过滤掉导致 0/0，
	// 因此最后兜底直接测量根目录 "/"。
	seenDisk := make(map[string]bool)
	rootCovered := false
	if partitions, err := disk.Partitions(true); err == nil {
		for _, partition := range partitions {
			if isVirtualFS(partition.Fstype) {
				continue
			}
			if partition.Device != "" && seenDisk[partition.Device] {
				continue
			}
			usage, err := disk.Usage(partition.Mountpoint)
			if err != nil || usage.Total == 0 {
				continue
			}
			if partition.Device != "" {
				seenDisk[partition.Device] = true
			}
			if partition.Mountpoint == "/" {
				rootCovered = true
			}
			info.DiskInfo = append(info.DiskInfo, DiskInfo{
				Device:     partition.Device,
				MountPoint: partition.Mountpoint,
				Total:      usage.Total,
				Used:       usage.Used,
				Free:       usage.Free,
				UsageRate:  usage.UsedPercent,
				FSType:     partition.Fstype,
			})
		}
	}
	// 兜底：若没有分区覆盖到根目录（典型：容器 overlay 根被跳过），直接测量 "/"
	if !rootCovered {
		if usage, err := disk.Usage("/"); err == nil && usage.Total > 0 {
			info.DiskInfo = append(info.DiskInfo, DiskInfo{
				Device:     "overlay",
				MountPoint: "/",
				Total:      usage.Total,
				Used:       usage.Used,
				Free:       usage.Free,
				UsageRate:  usage.UsedPercent,
				FSType:     usage.Fstype,
			})
		}
	}

	// 获取网络信息（跳过回环 lo，避免把内部流量计入总流量）
	netIOCounters, err := net.IOCounters(true)
	if err != nil {
		return nil, fmt.Errorf("获取网络信息失败: %w", err)
	}

	for _, netIO := range netIOCounters {
		if netIO.Name == "lo" {
			continue
		}
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

	// 进程数量
	if !c.skipProcs {
		pids, err := process.Pids()
		if err == nil {
			info.ProcessCount = len(pids)
		}
	}

	// TCP / UDP 连接数
	if !c.skipConn {
		conns, err := net.Connections("all")
		if err == nil {
			for _, conn := range conns {
				switch conn.Type {
				case 1: // TCP
					info.TcpCount++
				case 2: // UDP
					info.UdpCount++
				}
			}
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

// isVirtualFS 判断是否为伪/虚拟文件系统（不计入磁盘统计）。
// 注意：容器根 overlay 在此被跳过，由 disk.Usage("/") 兜底测量，
// 既能避免宿主机上重复计算 overlay 挂载，又能保证容器内能取到磁盘。
func isVirtualFS(fstype string) bool {
	switch fstype {
	case "tmpfs", "devtmpfs", "devfs", "overlay", "overlayfs", "aufs",
		"proc", "sysfs", "cgroup", "cgroup2", "pstore", "bpf", "tracefs",
		"debugfs", "securityfs", "configfs", "fusectl", "mqueue", "hugetlbfs",
		"ramfs", "nsfs", "autofs", "binfmt_misc", "squashfs", "fuse.lxcfs",
		"rpc_pipefs", "selinuxfs", "efivarfs", "none", "":
		return true
	}
	return false
}
