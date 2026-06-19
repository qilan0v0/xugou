package com.qltz.agent.reporter;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qltz.agent.collector.Collector;
import com.qltz.agent.collector.SystemInfo;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * HTTP 数据上报器，将系统信息通过 HTTP POST 上报到监控服务器。
 * 对应 Go 版本的 reporter.HTTPReporter。
 */
public class HttpReporter implements Reporter {

    private final String serverUrl;
    private final String apiToken;
    private final HttpClient client;
    private final ObjectMapper mapper;

    private long lastNetworkRX;
    private long lastNetworkTX;
    private Instant lastUpdateTime;
    private boolean registered;

    private boolean debug;

    public HttpReporter(String serverUrl, String apiToken, boolean debug) {
        this.serverUrl = serverUrl.endsWith("/") ? serverUrl.substring(0, serverUrl.length() - 1) : serverUrl;
        this.apiToken = apiToken;
        this.debug = debug;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.mapper = new ObjectMapper();
        this.lastUpdateTime = Instant.now();
    }

    @Override
    public void report(SystemInfo info) throws Exception {
        ensureRegistered(info);

        // 计算磁盘总计
        long diskTotal = 0, diskUsed = 0;
        if (info.getDiskInfo() != null) {
            for (SystemInfo.DiskInfo d : info.getDiskInfo()) {
                diskTotal += d.getTotal();
                diskUsed += d.getUsed();
            }
        }

        // 计算网络速率
        long currentRX = 0, currentTX = 0;
        if (info.getNetworkInfo() != null) {
            for (SystemInfo.NetworkInfo n : info.getNetworkInfo()) {
                currentRX += n.getBytesRecv();
                currentTX += n.getBytesSent();
            }
        }
        long networkRXRate = 0, networkTXRate = 0;
        if (lastUpdateTime != null) {
            long timeDiff = Duration.between(lastUpdateTime, Instant.now()).getSeconds();
            if (timeDiff > 0) {
                networkRXRate = (long) ((currentRX - lastNetworkRX) / (double) timeDiff / 1024);
                networkTXRate = (long) ((currentTX - lastNetworkTX) / (double) timeDiff / 1024);
            }
        }
        lastNetworkRX = currentRX;
        lastNetworkTX = currentTX;
        lastUpdateTime = Instant.now();

        String localIP = Collector.getLocalIP();
        StatusPayload payload = new StatusPayload();
        payload.token = apiToken;
        payload.cpuUsage = info.getCpuInfo() != null ? info.getCpuInfo().getUsage() : 0;
        payload.memoryTotal = info.getMemoryInfo() != null ? info.getMemoryInfo().getTotal() : 0;
        payload.memoryUsed = info.getMemoryInfo() != null ? info.getMemoryInfo().getUsed() : 0;
        payload.diskTotal = diskTotal;
        payload.diskUsed = diskUsed;
        payload.networkRX = networkRXRate;
        payload.networkTX = networkTXRate;
        payload.networkRXTotal = currentRX;
        payload.networkTXTotal = currentTX;
        payload.hostname = info.getHostname();
        payload.ipAddresses = List.of(localIP);
        payload.ipAddress = localIP;
        payload.os = info.getOs();
        payload.version = info.getVersion();
        if (info.getCpuInfo() != null) {
            payload.cpu = new CPUPayload();
            payload.cpu.usage = info.getCpuInfo().getUsage();
            payload.cpu.cores = info.getCpuInfo().getCores();
            payload.cpu.modelName = info.getCpuInfo().getModelName();
            payload.cpu.arch = info.getCpuInfo().getArch();
            payload.cpu.temperature = info.getCpuInfo().getTemperature();
        }
        payload.memory = info.getMemoryInfo();
        payload.disks = info.getDiskInfo();
        payload.network = info.getNetworkInfo();
        payload.load = info.getLoadInfo();
        payload.bootTime = info.getBootTime() != null ? info.getBootTime().toString() : "";
        payload.agentVersion = Collector.VERSION;
        payload.keepalive = 30;
        payload.processCount = info.getProcessCount();
        payload.tcpCount = info.getTcpCount();
        payload.udpCount = info.getUdpCount();

        String json = mapper.writeValueAsString(payload);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl + "/api/agents/status"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("User-Agent", "QLTZ-Agent/1.0")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new RuntimeException("服务器返回错误状态码: " + resp.statusCode());
        }

        if (debug) {
            double memPct = payload.memoryTotal > 0
                    ? (double) payload.memoryUsed / payload.memoryTotal * 100 : 0;
            double diskPct = payload.diskTotal > 0
                    ? (double) payload.diskUsed / payload.diskTotal * 100 : 0;
            System.out.printf("成功上报数据到服务器，token: %s, CPU: %.2f%%, 内存: %.2f%%, 硬盘: %.2f%%, 网络下载: %d KB/s, 网络上传: %d KB/s%n",
                    apiToken, payload.cpuUsage, memPct, diskPct, payload.networkRX, payload.networkTX);
        }
    }

    /**
     * 确保客户端已在服务器注册
     */
    private void ensureRegistered(SystemInfo info) throws Exception {
        if (registered) return;

        RegisterPayload reg = new RegisterPayload();
        reg.token = apiToken;
        reg.name = info.getHostname();
        reg.hostname = info.getHostname();
        reg.ipAddress = Collector.getLocalIP();
        reg.os = info.getOs();
        reg.version = info.getVersion();

        String json = mapper.writeValueAsString(reg);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl + "/api/agents/register"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("User-Agent", "QLTZ-Agent/1.0")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new RuntimeException("注册失败，服务器返回状态码: " + resp.statusCode());
        }

        RegisterResponse response = mapper.readValue(resp.body(), RegisterResponse.class);
        if (!response.success) {
            throw new RuntimeException("注册失败: " + response.message);
        }

        if (debug) {
            System.out.println("客户端注册/状态更新成功，通过Token: " + apiToken);
        }
        registered = true;
    }

    // --- payload classes ---

    static class StatusPayload {
        public String token;
        @JsonProperty("cpu_usage") public double cpuUsage;
        @JsonProperty("memory_total") public long memoryTotal;
        @JsonProperty("memory_used") public long memoryUsed;
        @JsonProperty("disk_total") public long diskTotal;
        @JsonProperty("disk_used") public long diskUsed;
        @JsonProperty("network_rx") public long networkRX;
        @JsonProperty("network_tx") public long networkTX;
        @JsonProperty("network_rx_total") public long networkRXTotal;
        @JsonProperty("network_tx_total") public long networkTXTotal;
        public String hostname;
        @JsonProperty("ip_addresses") public List<String> ipAddresses;
        @JsonProperty("ip_address") public String ipAddress;
        public String os;
        public String version;
        public CPUPayload cpu;
        public SystemInfo.MemoryInfo memory;
        public List<SystemInfo.DiskInfo> disks;
        public List<SystemInfo.NetworkInfo> network;
        public SystemInfo.LoadInfo load;
        @JsonProperty("boot_time") public String bootTime;
        @JsonProperty("agent_version") public String agentVersion;
        public int keepalive;
        @JsonProperty("process_count") public int processCount;
        @JsonProperty("tcp_count") public int tcpCount;
        @JsonProperty("udp_count") public int udpCount;
    }

    static class CPUPayload {
        public double usage;
        public int cores;
        @JsonProperty("model_name") public String modelName;
        public String arch;
        public Double temperature;
    }

    static class RegisterPayload {
        public String token;
        public String name;
        public String hostname;
        @JsonProperty("ip_address") public String ipAddress;
        public String os;
        public String version;
    }

    static class RegisterResponse {
        public boolean success;
        public String message;
        public AgentData agent;

        static class AgentData {
            public int id;
        }
    }
}
