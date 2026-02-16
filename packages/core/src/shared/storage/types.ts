/**
 * 存储项元数据
 */
export interface StorageItem<T = any> {
  value: T;
  expireAt?: number; // 过期时间戳，undefined 表示永不过期
}
