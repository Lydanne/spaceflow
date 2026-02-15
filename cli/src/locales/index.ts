import { addLocaleResources } from "@spaceflow/core";
import buildZhCN from "./zh-cn/build.json";
import buildEn from "./en/build.json";
import clearZhCN from "./zh-cn/clear.json";
import clearEn from "./en/clear.json";
import commitZhCN from "./zh-cn/commit.json";
import commitEn from "./en/commit.json";
import createZhCN from "./zh-cn/create.json";
import createEn from "./en/create.json";
import devZhCN from "./zh-cn/dev.json";
import devEn from "./en/dev.json";
import installZhCN from "./zh-cn/install.json";
import installEn from "./en/install.json";
import listZhCN from "./zh-cn/list.json";
import listEn from "./en/list.json";
import mcpZhCN from "./zh-cn/mcp.json";
import mcpEn from "./en/mcp.json";
import runxZhCN from "./zh-cn/runx.json";
import runxEn from "./en/runx.json";
import schemaZhCN from "./zh-cn/schema.json";
import schemaEn from "./en/schema.json";
import setupZhCN from "./zh-cn/setup.json";
import setupEn from "./en/setup.json";
import uninstallZhCN from "./zh-cn/uninstall.json";
import uninstallEn from "./en/uninstall.json";
import updateZhCN from "./zh-cn/update.json";
import updateEn from "./en/update.json";

type LocaleResource = Record<string, Record<string, string>>;

/** build 命令 i18n 资源 */
export const buildLocales: LocaleResource = {
  "zh-CN": buildZhCN,
  en: buildEn,
};

/** clear 命令 i18n 资源 */
export const clearLocales: LocaleResource = {
  "zh-CN": clearZhCN,
  en: clearEn,
};

/** commit 命令 i18n 资源 */
export const commitLocales: LocaleResource = {
  "zh-CN": commitZhCN,
  en: commitEn,
};

/** create 命令 i18n 资源 */
export const createLocales: LocaleResource = {
  "zh-CN": createZhCN,
  en: createEn,
};

/** dev 命令 i18n 资源 */
export const devLocales: LocaleResource = {
  "zh-CN": devZhCN,
  en: devEn,
};

/** install 命令 i18n 资源 */
export const installLocales: LocaleResource = {
  "zh-CN": installZhCN,
  en: installEn,
};

/** list 命令 i18n 资源 */
export const listLocales: LocaleResource = {
  "zh-CN": listZhCN,
  en: listEn,
};

/** mcp 命令 i18n 资源 */
export const mcpLocales: LocaleResource = {
  "zh-CN": mcpZhCN,
  en: mcpEn,
};

/** runx 命令 i18n 资源 */
export const runxLocales: LocaleResource = {
  "zh-CN": runxZhCN,
  en: runxEn,
};

/** schema 命令 i18n 资源 */
export const schemaLocales: LocaleResource = {
  "zh-CN": schemaZhCN,
  en: schemaEn,
};

/** setup 命令 i18n 资源 */
export const setupLocales: LocaleResource = {
  "zh-CN": setupZhCN,
  en: setupEn,
};

/** uninstall 命令 i18n 资源 */
export const uninstallLocales: LocaleResource = {
  "zh-CN": uninstallZhCN,
  en: uninstallEn,
};

/** update 命令 i18n 资源 */
export const updateLocales: LocaleResource = {
  "zh-CN": updateZhCN,
  en: updateEn,
};

/** 所有内部命令 i18n 资源映射 */
const allLocales: Record<string, LocaleResource> = {
  build: buildLocales,
  clear: clearLocales,
  commit: commitLocales,
  create: createLocales,
  dev: devLocales,
  install: installLocales,
  list: listLocales,
  mcp: mcpLocales,
  runx: runxLocales,
  schema: schemaLocales,
  setup: setupLocales,
  uninstall: uninstallLocales,
  update: updateLocales,
};

/**
 * 立即注册所有内部命令的 i18n 资源
 * 确保 @Command 装饰器中的 t() 在模块 import 时即可获取翻译
 */
for (const [ns, resources] of Object.entries(allLocales)) {
  addLocaleResources(ns, resources);
}
