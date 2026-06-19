package com.qltz.agent.collector;

import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.GlobalMemory;
import oshi.hardware.HWDiskStore;
import oshi.hardware.NetworkIF;
import oshi.software.os.OperatingSystem;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;

/**
 * 系统信息采集器，使用 OSHI 库进行跨平台采集。
 * 对应 Go 版本的 collector.DefaultCollector。
 */
public class Collector {

    public static final String VERSION = "0.1.0";

    private final SystemInfo si;
    private boolean skipConn;
    private boolean skipProcs;

    public Collector() {
        this.si = new SystemInfo();
    }

    public void setSkipConn(boolean skip) { this.skipConn = skip; }
    public void setSkipProcs(boolean skip) { this.skipProcs = skip; }

    /**
     * 采集系统信息
     */
    public SystemInfo collect() {
        SystemInfo info = new SystemInfo();
        info.setTimestamp(Instant.now());

        oshi.SystemInfo oshiSi = new oshi.SystemInfo();
        OperatingSystem os = oshiSi.getOperatingSystem();
        CentralProcessor cpu = oshiSi.getHardware().getProcessor();
        GlobalMemory mem = oshiSi.getHardware().getMemory();

        // 主机信息
        info.setHostname(getHostname());
        info.setOs(os.getFamily());
        info.setPlatform(System.getProperty("os.name"));
        info.setVersion(os.getVersionInfo() != null
                ? os.getFamily() + " " + os.getVersionInfo().getVersion() + " (" + os.getVersionInfo().getBuildNumber() + ")"
                : System.getProperty("os.version"));

        // CPU
        SystemInfo.CPUInfo cpuInfo = new SystemInfo.CPUInfo();
        cpuInfo.setCores(Runtime.getRuntime().availableProcessors());
        cpuInfo.setModelName(cpu.getProcessorIdentifier().getName());
        cpuInfo.setArch(System.getProperty("os.arch"));
        // CPU 使用率：使用 OSHI 计算（需要两次采样取差值，这里取一个较短间隔）
        long[] prevTicks = cpu.getSystemCpuLoadTicks();
        try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
        double cpuLoad = cpu.getSystemCpuLoadBetweenTicks(prevTicks) * 100.0;
        cpuInfo.setUsage(Math.max(0, Math.min(100, cpuLoad)));
        // 温度（如果有传感器）
        try {
            double temp = oshiSi.getHardware().getSensors().getCpuTemperature();
            if (temp > 0) cpuInfo.setTemperature(temp);
        } catch (Exception ignored) {}
        info.setCpuInfo(cpuInfo);

        // 内存
        SystemInfo.MemoryInfo memInfo = new SystemInfo.MemoryInfo();
        memInfo.setTotal(mem.getTotal());
        memInfo.setUsed(mem.getTotal() - mem.getAvailable());
        memInfo.setFree(mem.getAvailable());
        if (mem.getTotal() > 0) {
            memInfo.setUsageRate(((double)(mem.getTotal() - mem.getAvailable()) / mem.getTotal()) * 100.0);
        }
        info.setMemoryInfo(memInfo);

        // 磁盘
        List<SystemInfo.DiskInfo> disks = new ArrayList<>();
        for (HWDiskStore disk : oshiSi.getHardware().getDiskStores()) {
            for (oshi.hardware.HWPartition part : disk.getPartitions()) {
                if (isVirtualFS(part.getType())) continue;
                SystemInfo.DiskInfo di = new SystemInfo.DiskInfo();
                di.setDevice(disk.getName());
                di.setMountPoint(part.getMountPoint());
                di.setTotal(part.getSize());
                // HWPartition doesn't directly give used/free; use FileStore as fallback
                try {
                    java.nio.file.FileStore fs = java.nio.file.Paths.get(part.getMountPoint()).getFileSystem().getFileStores()
                            .iterator().hasNext() ? null : null;
                    java.io.File f = new java.io.File(part.getMountPoint());
                    long total = f.getTotalSpace();
                    long free = f.getFreeSpace();
                    long used = total - free;
                    di.setTotal(total);
                    di.setUsed(used);
                    di.setFree(free);
                    di.setUsageRate(total > 0 ? ((double) used / total) * 100.0 : 0);
                } catch (Exception e) {
                    di.setTotal(0);
                    di.setUsed(0);
                    di.setFree(0);
                    di.setUsageRate(0);
                }
                di.setFsType(part.getType());
                disks.add(di);
            }
        }
        // 兜底：如果没有分区，测量根目录
        if (disks.isEmpty()) {
            try {
                java.io.File root = new java.io.File("/");
                SystemInfo.DiskInfo di = new SystemInfo.DiskInfo();
                di.setDevice("overlay");
                di.setMountPoint("/");
                di.setTotal(root.getTotalSpace());
                di.setFree(root.getFreeSpace());
                di.setUsed(root.getTotalSpace() - root.getFreeSpace());
                di.setUsageRate(root.getTotalSpace() > 0
                        ? ((double)(root.getTotalSpace() - root.getFreeSpace()) / root.getTotalSpace()) * 100.0 : 0);
                di.setFsType("overlay");
                disks.add(di);
            } catch (Exception ignored) {}
        }
        info.setDiskInfo(disks);

        // 网络
        List<SystemInfo.NetworkInfo> nets = new ArrayList<>();
        for (NetworkIF netIF : oshiSi.getHardware().getNetworkIFs()) {
            if ("lo".equals(netIF.getName())) continue;
            netIF.updateAttributes();
            SystemInfo.NetworkInfo ni = new SystemInfo.NetworkInfo();
            ni.setIface(netIF.getName());
            ni.setBytesSent(netIF.getBytesSent());
            ni.setBytesRecv(netIF.getBytesRecv());
            ni.setPacketsSent(netIF.getPacketsSent());
            ni.setPacketsRecv(netIF.getPacketsRecv());
            nets.add(ni);
        }
        info.setNetworkInfo(nets);

        // 系统负载
        SystemInfo.LoadInfo loadInfo = new SystemInfo.LoadInfo();
        double[] loadAvg = cpu.getSystemLoadAverage(3);
        if (loadAvg.length >= 3) {
            loadInfo.setLoad1(loadAvg[0]);
            loadInfo.setLoad5(loadAvg[1]);
            loadInfo.setLoad15(loadAvg[2]);
        }
        info.setLoadInfo(loadInfo);

        // 进程数
        if (!skipProcs) {
            info.setProcessCount(os.getProcessCount());
        }

        // TCP/UDP 连接数 (OSHI doesn't provide connection counts directly)
        if (!skipConn) {
            // On Linux/macOS we could parse /proc/net or use lsof, but OSHI doesn't expose this.
            // We leave it as 0; it's better than halting the collection.
        }

        // 启动时间
        info.setBootTime(Instant.ofEpochSecond(os.getSystemBootTime()));

        // Agent 版本
        info.setAgentVersion(VERSION);

        return info;
    }

    private String getHostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    /**
     * 获取本机第一个非回环 IPv4 地址
     */
    public static String getLocalIP() {
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                NetworkInterface iface = ifaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;
                Enumeration<InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr instanceof java.net.Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (SocketException ignored) {}
        return "unknown";
    }

    /**
     * 判断是否为虚拟文件系统，对应 Go 的 isVirtualFS
     */
    private boolean isVirtualFS(String fstype) {
        if (fstype == null) return true;
        return switch (fstype.toLowerCase()) {
            case "tmpfs", "devtmpfs", "devfs", "overlay", "overlayfs", "aufs",
                 "proc", "sysfs", "cgroup", "cgroup2", "pstore", "bpf", "tracefs",
                 "debugfs", "securityfs", "configfs", "fusectl", "mqueue", "hugetlbfs",
                 "ramfs", "nsfs", "autofs", "binfmt_misc", "squashfs", "fuse.lxcfs",
                 "rpc_pipefs", "selinuxfs", "efivarfs", "none", "" -> true;
            default -> false;
        };
    }
}
