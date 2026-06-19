package com.qltz.agent.reporter;

import com.qltz.agent.collector.SystemInfo;

/**
 * 数据上报器接口，对应 Go 版本的 reporter.Reporter
 */
public interface Reporter {
    void report(SystemInfo info) throws Exception;
}
