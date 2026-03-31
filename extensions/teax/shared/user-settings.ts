import {
  DEFAULT_NOTIFY_PREFERENCES,
  type NotifyPreferences,
  type NotifyPreferencesInput,
  normalizeNotifyPreferences,
} from "./notify-events";

/**
 * 用户设置对象（存储于 users.settings）。
 */
export interface UserSettings {
  [key: string]: unknown;
  notifyPreferences: NotifyPreferences;
}

/**
 * 外部输入（接口 / DB 读取）使用的宽松类型。
 */
export interface UserSettingsInput {
  [key: string]: unknown;
  notifyPreferences?: NotifyPreferencesInput | null;
}

/** 用户设置默认值（新用户初始化 / 缺省回填使用） */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  notifyPreferences: DEFAULT_NOTIFY_PREFERENCES,
};

/**
 * 归一化用户设置，确保关键字段始终存在且类型稳定。
 */
export function normalizeUserSettings(input?: UserSettingsInput | null): UserSettings {
  const safeInput = input || {};
  return {
    ...safeInput,
    notifyPreferences: normalizeNotifyPreferences(safeInput.notifyPreferences),
  } as UserSettings;
}
