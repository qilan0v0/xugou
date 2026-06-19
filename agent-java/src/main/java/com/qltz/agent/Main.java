package com.qltz.agent;

import com.qltz.agent.collector.Collector;
import com.qltz.agent.collector.SystemInfo;
import com.qltz.agent.config.AgentConfig;
import com.qltz.agent.reporter.ConsoleReporter;
import com.qltz.agent.reporter.HttpReporter;
import com.qltz.agent.reporter.Reporter;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;
import picocli.CommandLine.ParentCommand;

import java.security.SecureRandom;
import java.util.concurrent.Callable;

/**
 * QLTZ Agent 主入口 — 系统监控探针 (Java 实现)
 * 对应 Go 版本的 main.go + cmd/agent/*.go
 */
@Command(
    name = "qltz-agent",
    version = "QLTZ Agent 0.1.0 (Java)",
    mixinStandardHelpOptions = true,
    description = "QLTZ Agent - 系统监控客户端",
    subcommands = {Main.StartCommand.class, Main.ConfigCommand.class, Main.VersionCommand.class}
)
public class Main implements Callable<Integer> {

    @Option(names = {"-s", "--server"}, description = "监控服务器地址")
    String server;

    @Option(names = {"--uuid"}, description = "API 令牌 (UUID 格式)")
    String uuid;

    @Option(names = {"-p", "--password"}, description = "Nezha 兼容: 同 --uuid")
    String password;

    @Option(names = {"--log-level"}, description = "日志级别 (debug, info, warn, error)", defaultValue = "info")
    String logLevel;

    @Option(names = {"-d", "--debug"}, description = "Nezha 兼容: 开启 debug 日志")
    boolean debugFlag;

    @Option(names = {"--tls"}, description = "Nezha 兼容: 使用 TLS 连接")
    boolean tls;

    @Option(names = {"--agent-id"}, description = "客户端 ID")
    int agentId;

    @Option(names = {"--skip-conn"}, description = "跳过连接数统计")
    boolean skipConn;

    @Option(names = {"--skip-procs"}, description = "跳过进程数统计")
    boolean skipProcs;

    @Option(names = {"-c", "--config"}, description = "配置文件路径 (默认为 ~/.qltz-agent.yaml)")
    String configFile;

    @Override
    public Integer call() {
        // 无子命令时：如果有内置配置则自动启动，否则显示帮助
        AgentConfig cfg = new AgentConfig();
        if (cfg.hasBuiltinServer()) {
            // 用内置配置自动启动
            try {
                return new StartCommand().startWithConfig(cfg);
            } catch (Exception e) {
                System.err.println("启动失败: " + e.getMessage());
                return 1;
            }
        }
        new CommandLine(this).usage(System.out);
        return 0;
    }

    // ==================== start 子命令 ====================

    @Command(name = "start", description = "启动 QLTZ Agent")
    static class StartCommand implements Callable<Integer> {

        @ParentCommand Main parent;

        @Option(names = {"-i", "--interval"}, description = "数据收集和上报间隔（秒）", defaultValue = "60")
        int interval;

        @Option(names = {"--report-delay"}, description = "Nezha 兼容: 同 --interval")
        int reportDelay;

        @Override
        public Integer call() throws Exception {
            AgentConfig cfg = new AgentConfig();

            // 加载配置文件
            try {
                cfg.loadFromFile(parent != null ? parent.configFile : null);
            } catch (Exception e) {
                System.err.println("警告: 配置文件读取错误: " + e.getMessage());
            }

            // CLI 参数覆盖
            if (parent != null) {
                if (parent.server != null) cfg.setServer(parent.server);
                if (parent.uuid != null) cfg.setUuid(parent.uuid);
                if (parent.password != null && (cfg.getUuid() == null || cfg.getUuid().isEmpty()))
                    cfg.setUuid(parent.password);
                if (parent.logLevel != null) cfg.setLogLevel(parent.logLevel);
                if (parent.debugFlag) cfg.setDebug(true);
                if (parent.tls) cfg.setTls(parent.tls);
                if (parent.skipConn) cfg.setSkipConn(true);
                if (parent.skipProcs) cfg.setSkipProcs(true);
                if (parent.agentId > 0) cfg.setAgentId(parent.agentId);
            }

            // interval: CLI --report-delay > CLI --interval > config
            int effectiveInterval = interval;
            if (reportDelay > 0) effectiveInterval = reportDelay;
            if (cfg.getInterval() != 60 && reportDelay <= 0) effectiveInterval = cfg.getInterval();

            return startWithConfig(cfg, effectiveInterval);
        }

        /**
         * 使用给定配置启动（支持从 auto-start 路径直接调用）
         */
        int startWithConfig(AgentConfig cfg) throws Exception {
            return startWithConfig(cfg, cfg.getInterval());
        }

        int startWithConfig(AgentConfig cfg, int effectiveInterval) throws Exception {
            // 环境变量覆盖（类似 NanoLimbo 的 loadEnvVars）
            String envServer = System.getenv("QLTZ_SERVER");
            String envToken = System.getenv("QLTZ_TOKEN");
            if (envServer != null && !envServer.isEmpty()) cfg.setServer(envServer);
            if (envToken != null && !envToken.isEmpty()) cfg.setUuid(envToken);

            // TLS
            String server = cfg.getServer();
            if (server != null && cfg.isTls() && !hasScheme(server)) {
                server = "https://" + server;
                cfg.setServer(server);
            }

            // 生成 UUID
            if (cfg.getUuid() == null || cfg.getUuid().isEmpty()) {
                String newUuid = generateUUID();
                cfg.setUuid(newUuid);
                try { cfg.save(); } catch (Exception ignored) {}
                System.out.println("已自动生成 UUID Token: " + newUuid + " (已保存到配置文件)");
            }

            if (cfg.getServer() == null || cfg.getServer().isEmpty()) {
                System.err.println("错误: 未设置服务器地址，请使用 -s 参数或在配置文件中设置");
                return 1;
            }

            boolean debug = cfg.isDebug();
            System.out.println("Qltz Agent 启动中...");
            System.out.println("服务器地址: " + cfg.getServer());
            System.out.println("收集间隔: " + effectiveInterval + "秒");
            if (debug) {
                if (cfg.isSkipConn()) System.out.println("跳过连接数统计");
                if (cfg.isSkipProcs()) System.out.println("跳过进程数统计");
            }
            System.out.println("使用令牌自动注册/上报数据");

            Collector collector = new Collector();
            collector.setSkipConn(cfg.isSkipConn());
            collector.setSkipProcs(cfg.isSkipProcs());

            Reporter reporter;
            if ("console".equals(cfg.getServer())) {
                reporter = new ConsoleReporter(debug);
                if (debug) System.out.println("使用控制台上报器");
            } else {
                reporter = new HttpReporter(cfg.getServer(), cfg.getUuid(), debug);
                if (debug) System.out.println("使用HTTP上报器");
            }

            // 首次延迟随机抖动
            long firstDelay = System.currentTimeMillis() / 1000 % 60;
            if (firstDelay > 0 && debug) {
                System.out.println(firstDelay + "秒后开始首次上报");
                Thread.sleep(firstDelay * 1000);
            }

            System.out.println("Qltz Agent 已启动，按 Ctrl+C 停止");

            Runtime.getRuntime().addShutdownHook(new Thread(() ->
                System.out.println("收到信号，正在停止...")
            ));

            collectAndReport(collector, reporter, debug);
            while (!Thread.currentThread().isInterrupted()) {
                Thread.sleep(effectiveInterval * 1000L);
                collectAndReport(collector, reporter, debug);
            }
            return 0;
        }

        void collectAndReport(Collector collector, Reporter reporter, boolean debug) {
            try {
                SystemInfo info = collector.collect();
                reporter.report(info);
                if (debug) {
                    System.out.println("系统信息已收集并上报，时间: " + info.getTimestamp());
                }
            } catch (Exception e) {
                System.err.println("收集或上报失败: " + e.getMessage());
            }
        }
    }

    // ==================== config 子命令 ====================

    @Command(name = "config", description = "配置 QLTZ Agent")
    static class ConfigCommand implements Callable<Integer> {

        @ParentCommand Main parent;

        @Override
        public Integer call() throws Exception {
            AgentConfig cfg = new AgentConfig();
            try { cfg.loadFromFile(parent != null ? parent.configFile : null); } catch (Exception ignored) {}

            System.out.println("当前配置:");
            System.out.println("  服务器地址: " + (cfg.getServer() != null ? cfg.getServer() : "(未设置)"));
            System.out.println("  API 令牌: " + (cfg.getUuid() != null ? AgentConfig.maskToken(cfg.getUuid()) : "(未设置)"));
            System.out.println("  收集间隔: " + cfg.getInterval() + "秒");
            System.out.println("  日志级别: " + cfg.getLogLevel());
            System.out.println("  配置文件: " + cfg.getConfigPath());

            try {
                cfg.save();
                System.out.println("配置已保存到: " + cfg.getConfigPath());
            } catch (Exception e) {
                System.err.println("错误: 无法保存配置: " + e.getMessage());
            }
            return 0;
        }
    }

    // ==================== version 子命令 ====================

    @Command(name = "version", description = "显示版本信息")
    static class VersionCommand implements Callable<Integer> {
        @Override
        public Integer call() {
            System.out.println("Qltz Agent 版本信息:");
            System.out.println("版本: 0.1.0");
            System.out.println("构建: Java 17");
            return 0;
        }
    }

    // ==================== 工具方法 ====================

    static boolean hasScheme(String u) {
        return u != null && (u.startsWith("http://") || u.startsWith("https://")
                || u.startsWith("wss://") || u.startsWith("ws://"));
    }

    static String generateUUID() {
        SecureRandom rng = new SecureRandom();
        byte[] b = new byte[16];
        rng.nextBytes(b);
        b[6] = (byte) ((b[6] & 0x0f) | 0x40); // version 4
        b[8] = (byte) ((b[8] & 0x3f) | 0x80); // variant
        StringBuilder sb = new StringBuilder(36);
        sb.append(String.format("%02x", b[0]));
        sb.append(String.format("%02x", b[1]));
        sb.append(String.format("%02x", b[2]));
        sb.append(String.format("%02x", b[3]));
        sb.append('-');
        sb.append(String.format("%02x", b[4]));
        sb.append(String.format("%02x", b[5]));
        sb.append('-');
        sb.append(String.format("%02x", b[6]));
        sb.append(String.format("%02x", b[7]));
        sb.append('-');
        sb.append(String.format("%02x", b[8]));
        sb.append(String.format("%02x", b[9]));
        sb.append('-');
        sb.append(String.format("%02x", b[10]));
        sb.append(String.format("%02x", b[11]));
        sb.append(String.format("%02x", b[12]));
        sb.append(String.format("%02x", b[13]));
        sb.append(String.format("%02x", b[14]));
        sb.append(String.format("%02x", b[15]));
        return sb.toString();
    }

    public static void main(String[] args) {
        int exitCode = new CommandLine(new Main()).execute(args);
        System.exit(exitCode);
    }
}
