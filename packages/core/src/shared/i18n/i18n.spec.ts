import { initI18n, t, addLocaleResources, resetI18n } from "./i18n";
import zhCN from "../../locales/zh-cn/translation.json";
import en from "../../locales/en/translation.json";

beforeEach(() => {
  resetI18n();
});

describe("initI18n", () => {
  it("默认初始化为 zh-CN", () => {
    initI18n("zh-CN");
    expect(t("common.options.dryRun")).toBe(zhCN["common.options.dryRun"]);
  });

  it("可以指定英文", () => {
    initI18n("en");
    expect(t("common.options.dryRun")).toBe(en["common.options.dryRun"]);
  });
});

describe("t", () => {
  it("返回中文公共翻译", () => {
    initI18n("zh-CN");
    expect(t("common.executionFailed", { error: "test" })).toBe("执行失败: test");
  });

  it("返回英文公共翻译", () => {
    initI18n("en");
    expect(t("common.executionFailed", { error: "test" })).toBe("Execution failed: test");
  });

  it("key 不存在时返回 key 本身", () => {
    initI18n("zh-CN");
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("未初始化时自动初始化", () => {
    const result = t("common.options.dryRun");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("addLocaleResources", () => {
  it("注册 Extension 命名空间并可通过 t 访问（中文）", () => {
    initI18n("zh-CN");
    addLocaleResources("build", {
      "zh-CN": { description: "构建插件", buildFailed: "构建失败: {{error}}" },
      en: { description: "Build plugins", buildFailed: "Build failed: {{error}}" },
    });
    expect(t("build:description")).toBe("构建插件");
    expect(t("build:buildFailed", { error: "test" })).toBe("构建失败: test");
  });

  it("注册 Extension 命名空间并可通过 t 访问（英文）", () => {
    initI18n("en");
    addLocaleResources("build", {
      "zh-CN": { description: "构建插件" },
      en: { description: "Build plugins" },
    });
    expect(t("build:description")).toBe("Build plugins");
  });

  it("多个命名空间互不干扰", () => {
    initI18n("zh-CN");
    addLocaleResources("ext-a", {
      "zh-CN": { name: "扩展A" },
      en: { name: "Extension A" },
    });
    addLocaleResources("ext-b", {
      "zh-CN": { name: "扩展B" },
      en: { name: "Extension B" },
    });
    expect(t("ext-a:name")).toBe("扩展A");
    expect(t("ext-b:name")).toBe("扩展B");
  });
});

describe("语言包完整性", () => {
  it("zh-cn 和 en 的 key 数量一致", () => {
    const zhKeys = Object.keys(zhCN).sort();
    const enKeys = Object.keys(en).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("所有 key 的值都不为空", () => {
    for (const [_key, value] of Object.entries(zhCN)) {
      expect(value).toBeTruthy();
      expect(typeof value).toBe("string");
    }
    for (const [_key, value] of Object.entries(en)) {
      expect(value).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });
});
