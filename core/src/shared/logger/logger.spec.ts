import { vi, type MockInstance } from "vitest";
import { Logger } from "./logger";

describe("Logger", () => {
  let consoleSpy: {
    log: MockInstance;
    warn: MockInstance;
    error: MockInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(),
      warn: vi.spyOn(console, "warn").mockImplementation(),
      error: vi.spyOn(console, "error").mockImplementation(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基础日志", () => {
    it("info 输出包含前缀和消息", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      logger.info("hello");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain("[test]");
      expect(output).toContain("hello");
    });

    it("success 输出包含 ✅", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      logger.success("done");
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain("✅");
      expect(output).toContain("done");
    });

    it("warn 使用 console.warn", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      logger.warn("caution");
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const output = consoleSpy.warn.mock.calls[0][0] as string;
      expect(output).toContain("caution");
    });

    it("error 使用 console.error", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      logger.error("fail");
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = consoleSpy.error.mock.calls[0][0] as string;
      expect(output).toContain("fail");
    });
  });

  describe("日志级别", () => {
    it("level=info 时 verbose 不输出", () => {
      const logger = new Logger({ name: "test", mode: "plain", level: "info" });
      logger.verbose("detail");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("level=verbose 时 verbose 输出", () => {
      const logger = new Logger({ name: "test", mode: "plain", level: "verbose" });
      logger.verbose("detail");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it("level=verbose 时 debug 不输出", () => {
      const logger = new Logger({ name: "test", mode: "plain", level: "verbose" });
      logger.debug("trace");
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("level=debug 时 debug 输出", () => {
      const logger = new Logger({ name: "test", mode: "plain", level: "debug" });
      logger.debug("trace");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain("[DEBUG]");
    });

    it("level=silent 时所有日志不输出", () => {
      const logger = new Logger({ name: "test", mode: "plain", level: "silent" });
      logger.info("a");
      logger.success("b");
      logger.warn("c");
      logger.error("d");
      logger.verbose("e");
      logger.debug("f");
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe("字符串构造", () => {
    it("支持字符串参数快捷创建", () => {
      const logger = new Logger("build");
      logger.info("start");
      // 不报错即可，auto 模式下可能是 plain 或 tui
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe("child", () => {
    it("子 Logger 前缀包含父命名空间", () => {
      const logger = new Logger({ name: "build", mode: "plain" });
      const child = logger.child("compile");
      child.info("processing");
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain("[build:compile]");
    });
  });

  describe("Spinner (plain 模式)", () => {
    it("spin 输出开始消息", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      const spinner = logger.spin("loading");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0] as string;
      expect(output).toContain("loading");
      spinner.succeed("loaded");
      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    });
  });

  describe("ProgressBar (plain 模式)", () => {
    it("progress 输出进度信息", () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      const bar = logger.progress({ total: 10, label: "files" });
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      bar.update(5);
      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
      const output = consoleSpy.log.mock.calls[1][0] as string;
      expect(output).toContain("50%");
      bar.finish();
      expect(consoleSpy.log).toHaveBeenCalledTimes(3);
    });
  });

  describe("Tasks (plain 模式)", () => {
    it("顺序执行任务并输出状态", async () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      const results = await logger.tasks([
        { title: "步骤1", task: async () => "a" as never },
        { title: "步骤2", task: async () => "b" as never },
      ]);
      expect(results).toHaveLength(2);
      const allOutput = consoleSpy.log.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(allOutput).toContain("步骤1");
      expect(allOutput).toContain("步骤2");
    });

    it("任务失败时抛出错误", async () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      await expect(
        logger.tasks([
          {
            title: "会失败",
            task: async () => {
              throw new Error("boom");
            },
          },
        ]),
      ).rejects.toThrow("boom");
    });

    it("enabled=false 的任务被跳过", async () => {
      const logger = new Logger({ name: "test", mode: "plain" });
      const taskFn = vi.fn();
      await logger.tasks([{ title: "跳过", task: taskFn, enabled: false }]);
      expect(taskFn).not.toHaveBeenCalled();
    });
  });
});
