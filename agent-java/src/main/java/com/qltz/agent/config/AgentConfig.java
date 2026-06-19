package com.qltz.agent.config;

import org.yaml.snakeyaml.Yaml;

import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Agent 配置管理，支持 YAML 配置文件读写。
 * 对应 Go 版本的 config.go。
 */
public class AgentConfig {

    private String server;
    private String uuid;
    private int interval = 60;
    private String logLevel = "info";
    private boolean tls;
    private boolean skipConn;
    private boolean skipProcs;
    private int agentId;

    private Path configPath;

    public AgentConfig() {
        String home = System.getProperty("user.home");
        this.configPath = Paths.get(home, ".qltz-agent.yaml");
        // 首先加载编译时内置的默认值
        loadBuiltinDefaults();
    }

    /**
     * 从 classpath 的 agent.properties 加载编译时内置配置。
     * 通过 mvn package -Dbuild.server=... -Dbuild.token=... 注入。
     */
    private void loadBuiltinDefaults() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("agent.properties")) {
            if (is == null) return;
            Properties props = new Properties();
            props.load(is);

            String s = props.getProperty("server");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) server = s;

            s = props.getProperty("token");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) uuid = s;

            s = props.getProperty("interval");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) {
                try { interval = Integer.parseInt(s); } catch (NumberFormatException ignored) {}
            }

            s = props.getProperty("log_level");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) logLevel = s;

            s = props.getProperty("skip_conn");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) skipConn = Boolean.parseBoolean(s);

            s = props.getProperty("skip_procs");
            if (s != null && !s.isEmpty() && !s.startsWith("${")) skipProcs = Boolean.parseBoolean(s);
        } catch (IOException ignored) {}
    }

    /**
     * 检查编译时是否已内置了 server 和 token
     */
    public boolean hasBuiltinServer() {
        return server != null && !server.isEmpty();
    }

    public boolean hasBuiltinToken() {
        return uuid != null && !uuid.isEmpty();
    }

    /**
     * 从 YAML 文件加载配置
     */
    public void loadFromFile(String path) throws IOException {
        if (path != null && !path.isEmpty()) {
            configPath = Paths.get(path);
        }
        if (!Files.exists(configPath)) {
            return;
        }
        Yaml yaml = new Yaml();
        try (InputStream is = new FileInputStream(configPath.toFile())) {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = yaml.load(is);
            if (data == null) return;

            if (data.get("server") instanceof String s) server = s;
            if (data.get("uuid") instanceof String s) uuid = s;
            if (data.get("password") instanceof String s && (uuid == null || uuid.isEmpty())) uuid = s;
            if (data.get("interval") instanceof Integer i) interval = i;
            if (data.get("report_delay") instanceof Integer i && i > 0) interval = i;
            if (data.get("log_level") instanceof String s) logLevel = s;
            if (data.get("tls") instanceof Boolean b) tls = b;
            if (data.get("skip_conn") instanceof Boolean b) skipConn = b;
            if (data.get("skip_procs") instanceof Boolean b) skipProcs = b;
            if (data.get("agent_id") instanceof Integer i) agentId = i;

            // Nezha v1 config.yaml 字段映射
            if (data.get("client_secret") instanceof String s && (uuid == null || uuid.isEmpty())) uuid = s;
            if (data.get("skip_connection_count") instanceof Boolean b) skipConn = b;
            if (data.get("skip_procs_count") instanceof Boolean b) skipProcs = b;
        }
    }

    /**
     * 保存配置到 YAML 文件
     */
    public void save() throws IOException {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("server", server);
        data.put("uuid", uuid);
        data.put("interval", interval);
        data.put("log_level", logLevel);

        Yaml yaml = new Yaml();
        try (FileWriter w = new FileWriter(configPath.toFile())) {
            yaml.dump(data, w);
        }
    }

    // --- getters/setters ---

    public String getServer() { return server; }
    public void setServer(String server) { this.server = server; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getPassword() { return uuid; }
    public void setPassword(String password) { this.uuid = password; }

    public int getInterval() { return interval; }
    public void setInterval(int interval) { this.interval = interval; }

    public String getLogLevel() { return logLevel; }
    public void setLogLevel(String logLevel) { this.logLevel = logLevel; }

    public boolean isDebug() { return "debug".equalsIgnoreCase(logLevel); }
    public void setDebug(boolean debug) { this.logLevel = debug ? "debug" : "info"; }

    public boolean isTls() { return tls; }
    public void setTls(boolean tls) { this.tls = tls; }

    public boolean isSkipConn() { return skipConn; }
    public void setSkipConn(boolean skipConn) { this.skipConn = skipConn; }

    public boolean isSkipProcs() { return skipProcs; }
    public void setSkipProcs(boolean skipProcs) { this.skipProcs = skipProcs; }

    public int getAgentId() { return agentId; }
    public void setAgentId(int agentId) { this.agentId = agentId; }

    public Path getConfigPath() { return configPath; }

    /**
     * 掩码令牌，只显示前4位和后4位
     */
    public static String maskToken(String token) {
        if (token == null || token.length() <= 8) return token;
        return token.substring(0, 4) + "..." + token.substring(token.length() - 4);
    }
}
