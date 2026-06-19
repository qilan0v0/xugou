# QLTZ Agent (Java)

基于 Java 17 的系统监控探针，采集 CPU、内存、磁盘、网络、负载、进程数等信息并上报到 QLTZ 监控服务器。

## 快速开始

### 下载

从 [Releases](https://github.com/qilan0v0/xugou/releases) 下载 `server.jar`。

### 运行

```bash
java -jar server.jar
```

如果 JAR 编译时已内置服务器地址和令牌，直接启动即可，无需任何参数。

### 手动指定参数

```bash
# Xugou 原生参数
java -jar server.jar start -s https://your-server.com --uuid YOUR_TOKEN

# Nezha v0 兼容
java -jar server.jar start -s server:8008 -p YOUR_KEY --tls

# 调试模式
java -jar server.jar start -s https://your-server.com --uuid YOUR_TOKEN --log-level debug
```

## 子命令

| 命令 | 说明 |
|------|------|
| `start` | 启动探针，开始采集和上报 |
| `config` | 查看/保存当前配置到 `~/.qltz-agent.yaml` |
| `version` | 显示版本信息 |

## 参数说明

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--server` | `-s` | 监控服务器地址 | 编译时内置 |
| `--uuid` | | API 令牌 (UUID 格式) | 编译时内置 / 自动生成 |
| `--password` | `-p` | Nezha 兼容: 同 `--uuid` | |
| `--interval` | `-i` | 采集上报间隔（秒） | 60 |
| `--log-level` | | 日志级别: debug / info | info |
| `--debug` | `-d` | Nezha 兼容: 开启 debug | false |
| `--tls` | | Nezha 兼容: 自动加 https:// 前缀 | false |
| `--skip-conn` | | 跳过 TCP/UDP 连接数统计 | false |
| `--skip-procs` | | 跳过进程数统计 | false |
| `--config` | `-c` | 配置文件路径 | `~/.qltz-agent.yaml` |
| `--agent-id` | | 客户端 ID | 0 |

## 配置优先级

配置按以下顺序叠加，后面的会覆盖前面的：

```
编译内置值  <  YAML 配置文件  <  环境变量  <  CLI 参数
```

### 1. 编译内置（agent.properties）

Maven 构建时通过 `-D` 注入：

```bash
mvn package -Dbuild.server=https://your-server.com -Dbuild.token=YOUR_TOKEN
```

### 2. YAML 配置文件

`~/.qltz-agent.yaml`：

```yaml
server: https://your-server.com
uuid: your-token
interval: 60
log_level: info
```

### 3. 环境变量

像 NanoLimbo 探针一样，可在运行时用环境变量覆盖：

```bash
QLTZ_SERVER=https://your-server.com QLTZ_TOKEN=your-token java -jar server.jar
```

### 4. CLI 参数

```bash
java -jar server.jar start -s https://your-server.com --uuid YOUR_TOKEN
```

## 自行编译

```bash
cd agent-java

# 不带内置配置（运行时需传参）
mvn clean package -DskipTests

# 带内置配置（编译后直接 java -jar 即可）
mvn clean package -DskipTests \
  -Dbuild.server=https://your-server.com \
  -Dbuild.token=YOUR_TOKEN

# 输出: target/server.jar
```

编译参数一览：

| Maven 属性 | 说明 | 默认 |
|------------|------|------|
| `-Dbuild.server` | 内置服务器地址 | 空 |
| `-Dbuild.token` | 内置 API 令牌 | 空 |
| `-Dbuild.interval` | 内置采集间隔 | 60 |
| `-Dbuild.log_level` | 内置日志级别 | info |
| `-Dbuild.skip_conn` | 内置跳过连接数 | false |
| `-Dbuild.skip_procs` | 内置跳过进程数 | false |

## GitHub Actions 自动编译

仓库已配置 `.github/workflows/build-java.yml`。

### 设置 Secrets

在仓库 Settings → Secrets and variables → Actions 添加：

| Secret | 说明 |
|--------|------|
| `QLTZ_SERVER` | 监控服务器地址 |
| `QLTZ_TOKEN` | API 令牌 |

### 触发构建

推送 tag 或手动在 Actions 页面触发：

```bash
git tag v0.3.0 && git push origin v0.3.0
```

构建完成后，`server.jar` 自动上传到 Releases。

## 项目结构

```
agent-java/
├── pom.xml
├── .gitignore
└── src/main/
    ├── java/com/qltz/agent/
    │   ├── Main.java              # CLI 入口 (picocli)
    │   ├── collector/
    │   │   ├── SystemInfo.java     # 数据模型
    │   │   └── Collector.java      # 系统指标采集 (OSHI)
    │   ├── reporter/
    │   │   ├── Reporter.java       # 上报器接口
    │   │   ├── HttpReporter.java   # HTTP 上报
    │   │   └── ConsoleReporter.java # 控制台输出
    │   └── config/
    │       └── AgentConfig.java    # 配置管理 (YAML)
    └── resources/
        └── agent.properties        # 编译时内置配置模板
```

## 依赖

| 库 | 用途 |
|----|------|
| [OSHI](https://github.com/oshi/oshi) | 跨平台系统信息采集 |
| [Jackson](https://github.com/FasterXML/jackson) | JSON 序列化 |
| [SnakeYAML](https://bitbucket.org/snakeyaml/snakeyaml) | YAML 配置文件解析 |
| [Picocli](https://picocli.info/) | CLI 命令行解析 |

## 环境要求

- Java 17+
