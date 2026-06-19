package com.qltz.agent.collector;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 系统信息数据模型，对应 Go 版本的 SystemInfo
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SystemInfo {

    @JsonProperty("timestamp")
    private Instant timestamp;

    @JsonProperty("hostname")
    private String hostname;

    @JsonProperty("platform")
    private String platform;

    @JsonProperty("os")
    private String os;

    @JsonProperty("version")
    private String version;

    @JsonProperty("cpu")
    private CPUInfo cpuInfo;

    @JsonProperty("memory")
    private MemoryInfo memoryInfo;

    @JsonProperty("disks")
    private List<DiskInfo> diskInfo = new ArrayList<>();

    @JsonProperty("network")
    private List<NetworkInfo> networkInfo = new ArrayList<>();

    @JsonProperty("load")
    private LoadInfo loadInfo;

    @JsonProperty("process_count")
    private int processCount;

    @JsonProperty("tcp_count")
    private int tcpCount;

    @JsonProperty("udp_count")
    private int udpCount;

    @JsonProperty("boot_time")
    private Instant bootTime;

    @JsonProperty("agent_version")
    private String agentVersion;

    // --- getters/setters ---

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getOs() { return os; }
    public void setOs(String os) { this.os = os; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public CPUInfo getCpuInfo() { return cpuInfo; }
    public void setCpuInfo(CPUInfo cpuInfo) { this.cpuInfo = cpuInfo; }

    public MemoryInfo getMemoryInfo() { return memoryInfo; }
    public void setMemoryInfo(MemoryInfo memoryInfo) { this.memoryInfo = memoryInfo; }

    public List<DiskInfo> getDiskInfo() { return diskInfo; }
    public void setDiskInfo(List<DiskInfo> diskInfo) { this.diskInfo = diskInfo; }

    public List<NetworkInfo> getNetworkInfo() { return networkInfo; }
    public void setNetworkInfo(List<NetworkInfo> networkInfo) { this.networkInfo = networkInfo; }

    public LoadInfo getLoadInfo() { return loadInfo; }
    public void setLoadInfo(LoadInfo loadInfo) { this.loadInfo = loadInfo; }

    public int getProcessCount() { return processCount; }
    public void setProcessCount(int processCount) { this.processCount = processCount; }

    public int getTcpCount() { return tcpCount; }
    public void setTcpCount(int tcpCount) { this.tcpCount = tcpCount; }

    public int getUdpCount() { return udpCount; }
    public void setUdpCount(int udpCount) { this.udpCount = udpCount; }

    public Instant getBootTime() { return bootTime; }
    public void setBootTime(Instant bootTime) { this.bootTime = bootTime; }

    public String getAgentVersion() { return agentVersion; }
    public void setAgentVersion(String agentVersion) { this.agentVersion = agentVersion; }

    // --- inner data classes ---

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CPUInfo {
        @JsonProperty("usage")
        private double usage;
        @JsonProperty("cores")
        private int cores;
        @JsonProperty("model_name")
        private String modelName;
        @JsonProperty("arch")
        private String arch;
        @JsonProperty("temperature")
        private Double temperature;

        public double getUsage() { return usage; }
        public void setUsage(double usage) { this.usage = usage; }
        public int getCores() { return cores; }
        public void setCores(int cores) { this.cores = cores; }
        public String getModelName() { return modelName; }
        public void setModelName(String modelName) { this.modelName = modelName; }
        public String getArch() { return arch; }
        public void setArch(String arch) { this.arch = arch; }
        public Double getTemperature() { return temperature; }
        public void setTemperature(Double temperature) { this.temperature = temperature; }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MemoryInfo {
        @JsonProperty("total")
        private long total;
        @JsonProperty("used")
        private long used;
        @JsonProperty("free")
        private long free;
        @JsonProperty("usage_rate")
        private double usageRate;

        public long getTotal() { return total; }
        public void setTotal(long total) { this.total = total; }
        public long getUsed() { return used; }
        public void setUsed(long used) { this.used = used; }
        public long getFree() { return free; }
        public void setFree(long free) { this.free = free; }
        public double getUsageRate() { return usageRate; }
        public void setUsageRate(double usageRate) { this.usageRate = usageRate; }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DiskInfo {
        @JsonProperty("device")
        private String device;
        @JsonProperty("mount_point")
        private String mountPoint;
        @JsonProperty("total")
        private long total;
        @JsonProperty("used")
        private long used;
        @JsonProperty("free")
        private long free;
        @JsonProperty("usage_rate")
        private double usageRate;
        @JsonProperty("fs_type")
        private String fsType;

        public String getDevice() { return device; }
        public void setDevice(String device) { this.device = device; }
        public String getMountPoint() { return mountPoint; }
        public void setMountPoint(String mountPoint) { this.mountPoint = mountPoint; }
        public long getTotal() { return total; }
        public void setTotal(long total) { this.total = total; }
        public long getUsed() { return used; }
        public void setUsed(long used) { this.used = used; }
        public long getFree() { return free; }
        public void setFree(long free) { this.free = free; }
        public double getUsageRate() { return usageRate; }
        public void setUsageRate(double usageRate) { this.usageRate = usageRate; }
        public String getFsType() { return fsType; }
        public void setFsType(String fsType) { this.fsType = fsType; }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NetworkInfo {
        @JsonProperty("interface")
        private String iface;
        @JsonProperty("bytes_sent")
        private long bytesSent;
        @JsonProperty("bytes_recv")
        private long bytesRecv;
        @JsonProperty("packets_sent")
        private long packetsSent;
        @JsonProperty("packets_recv")
        private long packetsRecv;

        public String getIface() { return iface; }
        public void setIface(String iface) { this.iface = iface; }
        public long getBytesSent() { return bytesSent; }
        public void setBytesSent(long bytesSent) { this.bytesSent = bytesSent; }
        public long getBytesRecv() { return bytesRecv; }
        public void setBytesRecv(long bytesRecv) { this.bytesRecv = bytesRecv; }
        public long getPacketsSent() { return packetsSent; }
        public void setPacketsSent(long packetsSent) { this.packetsSent = packetsSent; }
        public long getPacketsRecv() { return packetsRecv; }
        public void setPacketsRecv(long packetsRecv) { this.packetsRecv = packetsRecv; }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LoadInfo {
        @JsonProperty("load1")
        private double load1;
        @JsonProperty("load5")
        private double load5;
        @JsonProperty("load15")
        private double load15;

        public double getLoad1() { return load1; }
        public void setLoad1(double load1) { this.load1 = load1; }
        public double getLoad5() { return load5; }
        public void setLoad5(double load5) { this.load5 = load5; }
        public double getLoad15() { return load15; }
        public void setLoad15(double load15) { this.load15 = load15; }
    }
}
