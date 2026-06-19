package com.qltz.agent.reporter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.qltz.agent.collector.SystemInfo;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 控制台上报器，将系统信息格式化输出到控制台。
 * 对应 Go 版本的 reporter.ConsoleReporter。
 */
public class ConsoleReporter implements Reporter {

    private final ObjectMapper mapper;
    private final boolean debug;
    private static final DateTimeFormatter FMT = DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    public ConsoleReporter(boolean debug) {
        this.debug = debug;
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    @Override
    public void report(SystemInfo info) throws Exception {
        if (!debug) return;

        System.out.println("系统信息收集时间: " + FMT.format(info.getTimestamp()));
        System.out.println("主机名: " + info.getHostname());
        System.out.println("平台: " + info.getPlatform() + " " + info.getOs());
        if (info.getCpuInfo() != null) {
            System.out.println("CPU使用率: " + String.format("%.2f", info.getCpuInfo().getUsage()) + "%");
        }
        if (info.getMemoryInfo() != null) {
            System.out.println("内存使用率: " + String.format("%.2f", info.getMemoryInfo().getUsageRate()) + "%");
        }
        if (info.getLoadInfo() != null) {
            System.out.println("系统负载: " + String.format("%.2f", info.getLoadInfo().getLoad1())
                    + " " + String.format("%.2f", info.getLoadInfo().getLoad5())
                    + " " + String.format("%.2f", info.getLoadInfo().getLoad15()));
        }
        System.out.println("详细信息:");
        System.out.println(mapper.writeValueAsString(info));
    }
}
