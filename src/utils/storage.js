/**
 * 存储管理模块
 * 封装Chrome Storage API，提供加密存储敏感数据功能
 */

import { encrypt, decrypt } from './crypto.js';

// 存储键名常量
export const STORAGE_KEYS = {
  API_CONFIGS: 'api_configs',
  ACTIVE_CONFIG_ID: 'active_config_id',
  SETTINGS: 'settings',
  HISTORY: 'recognition_history',
  STATS: 'statistics'
};

// 默认设置
export const DEFAULT_SETTINGS = {
  timeout: 30000,
  retryCount: 3,
  autoFill: true,
  autoSubmit: false,
  debugMode: false,
  historyRetention: 7 // 天数
};

/**
 * 获取存储数据
 * @param {string|string[]} keys - 要获取的键名
 * @returns {Promise<object>}
 */
export async function get(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 设置存储数据
 * @param {object} data - 要存储的数据
 * @returns {Promise<void>}
 */
export async function set(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 删除存储数据
 * @param {string|string[]} keys - 要删除的键名
 * @returns {Promise<void>}
 */
export async function remove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 清空所有存储数据
 * @returns {Promise<void>}
 */
export async function clear() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ==================== API配置管理 ====================

/**
 * 获取所有API配置
 * @returns {Promise<Array>}
 */
export async function getApiConfigs() {
  const result = await get(STORAGE_KEYS.API_CONFIGS);
  return result[STORAGE_KEYS.API_CONFIGS] || [];
}

/**
 * 保存API配置（加密存储API密钥）
 * @param {Array} configs - API配置数组
 * @returns {Promise<void>}
 */
export async function saveApiConfigs(configs) {
  // 加密每个配置的API密钥
  const encryptedConfigs = await Promise.all(
    configs.map(async (config) => ({
      ...config,
      apiKey: config.apiKey ? await encrypt(config.apiKey) : ''
    }))
  );

  await set({ [STORAGE_KEYS.API_CONFIGS]: encryptedConfigs });
}

/**
 * 获取解密后的API配置
 * @returns {Promise<Array>}
 */
export async function getDecryptedApiConfigs() {
  const configs = await getApiConfigs();

  return Promise.all(
    configs.map(async (config) => ({
      ...config,
      apiKey: config.apiKey ? await decrypt(config.apiKey) : ''
    }))
  );
}

/**
 * 添加新的API配置
 * @param {object} config - 新配置
 * @returns {Promise<string>} - 新配置的ID
 */
export async function addApiConfig(config) {
  const configs = await getApiConfigs();
  const newConfig = {
    ...config,
    id: generateId(),
    createdAt: Date.now()
  };

  // 加密API密钥
  newConfig.apiKey = newConfig.apiKey ? await encrypt(newConfig.apiKey) : '';

  configs.push(newConfig);
  await set({ [STORAGE_KEYS.API_CONFIGS]: configs });

  // 如果是第一个配置，设为活跃配置
  if (configs.length === 1) {
    await setActiveConfigId(newConfig.id);
  }

  return newConfig.id;
}

/**
 * 更新API配置
 * @param {string} id - 配置ID
 * @param {object} updates - 更新内容
 * @returns {Promise<void>}
 */
export async function updateApiConfig(id, updates) {
  const configs = await getApiConfigs();
  const index = configs.findIndex(c => c.id === id);

  if (index === -1) {
    throw new Error('配置不存在');
  }

  // 如果更新了API密钥，重新加密
  if (updates.apiKey !== undefined) {
    updates.apiKey = updates.apiKey ? await encrypt(updates.apiKey) : '';
  }

  configs[index] = {
    ...configs[index],
    ...updates,
    updatedAt: Date.now()
  };

  await set({ [STORAGE_KEYS.API_CONFIGS]: configs });
}

/**
 * 删除API配置
 * @param {string} id - 配置ID
 * @returns {Promise<void>}
 */
export async function deleteApiConfig(id) {
  const configs = await getApiConfigs();
  const filteredConfigs = configs.filter(c => c.id !== id);

  await set({ [STORAGE_KEYS.API_CONFIGS]: filteredConfigs });

  // 如果删除的是活跃配置，切换到第一个配置
  const activeId = await getActiveConfigId();
  if (activeId === id && filteredConfigs.length > 0) {
    await setActiveConfigId(filteredConfigs[0].id);
  } else if (filteredConfigs.length === 0) {
    await remove(STORAGE_KEYS.ACTIVE_CONFIG_ID);
  }
}

/**
 * 获取当前活跃的配置ID
 * @returns {Promise<string|null>}
 */
export async function getActiveConfigId() {
  const result = await get(STORAGE_KEYS.ACTIVE_CONFIG_ID);
  return result[STORAGE_KEYS.ACTIVE_CONFIG_ID] || null;
}

/**
 * 设置活跃配置ID
 * @param {string} id - 配置ID
 * @returns {Promise<void>}
 */
export async function setActiveConfigId(id) {
  await set({ [STORAGE_KEYS.ACTIVE_CONFIG_ID]: id });
}

/**
 * 获取当前活跃的API配置（解密后）
 * @returns {Promise<object|null>}
 */
export async function getActiveConfig() {
  const activeId = await getActiveConfigId();
  if (!activeId) return null;

  const configs = await getDecryptedApiConfigs();
  return configs.find(c => c.id === activeId) || null;
}

// ==================== 设置管理 ====================

/**
 * 获取设置
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const result = await get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

/**
 * 保存设置
 * @param {object} settings - 设置对象
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * 更新部分设置
 * @param {object} updates - 要更新的设置
 * @returns {Promise<void>}
 */
export async function updateSettings(updates) {
  const current = await getSettings();
  await saveSettings({ ...current, ...updates });
}

// ==================== 历史记录管理 ====================

/**
 * 获取识别历史
 * @param {number} limit - 限制数量
 * @returns {Promise<Array>}
 */
export async function getHistory(limit = 100) {
  const result = await get(STORAGE_KEYS.HISTORY);
  const history = result[STORAGE_KEYS.HISTORY] || [];
  return history.slice(0, limit);
}

/**
 * 添加历史记录
 * @param {object} record - 历史记录
 * @returns {Promise<void>}
 */
export async function addHistory(record) {
  const history = await getHistory(999);
  const newRecord = {
    ...record,
    id: generateId(),
    timestamp: Date.now()
  };

  history.unshift(newRecord);

  // 清理过期记录
  const settings = await getSettings();
  const retentionMs = settings.historyRetention * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  const filteredHistory = history.filter(r => r.timestamp > cutoff);

  // 最多保留500条
  await set({ [STORAGE_KEYS.HISTORY]: filteredHistory.slice(0, 500) });
}

/**
 * 清空历史记录
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  await set({ [STORAGE_KEYS.HISTORY]: [] });
}

// ==================== 统计管理 ====================

/**
 * 获取统计数据
 * @returns {Promise<object>}
 */
export async function getStats() {
  const result = await get(STORAGE_KEYS.STATS);
  return result[STORAGE_KEYS.STATS] || {
    totalRequests: 0,
    successCount: 0,
    failCount: 0,
    totalTime: 0
  };
}

/**
 * 更新统计数据
 * @param {boolean} success - 是否成功
 * @param {number} time - 耗时（毫秒）
 * @returns {Promise<void>}
 */
export async function updateStats(success, time = 0) {
  const stats = await getStats();

  stats.totalRequests++;
  if (success) {
    stats.successCount++;
  } else {
    stats.failCount++;
  }
  stats.totalTime += time;

  await set({ [STORAGE_KEYS.STATS]: stats });
}

/**
 * 重置统计数据
 * @returns {Promise<void>}
 */
export async function resetStats() {
  await set({
    [STORAGE_KEYS.STATS]: {
      totalRequests: 0,
      successCount: 0,
      failCount: 0,
      totalTime: 0
    }
  });
}

// ==================== 工具函数 ====================

/**
 * 生成唯一ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ==================== 网站规则管理 ====================

const SITE_RULES_KEY = 'site_rules';

/**
 * 获取所有网站规则
 * @returns {Promise<object>} - 域名->规则的映射
 */
export async function getSiteRules() {
  const result = await get(SITE_RULES_KEY);
  return result[SITE_RULES_KEY] || {};
}

/**
 * 获取指定网站的规则
 * @param {string} hostname - 域名
 * @returns {Promise<object|null>}
 */
export async function getSiteRule(hostname) {
  const rules = await getSiteRules();
  return rules[hostname] || null;
}

/**
 * 保存网站规则
 * @param {string} hostname - 域名
 * @param {object} rule - 规则对象
 * @returns {Promise<void>}
 */
export async function saveSiteRule(hostname, rule) {
  const rules = await getSiteRules();
  rules[hostname] = {
    ...rule,
    hostname,
    updatedAt: Date.now()
  };
  await set({ [SITE_RULES_KEY]: rules });
}

/**
 * 删除网站规则
 * @param {string} hostname - 域名
 * @returns {Promise<void>}
 */
export async function deleteSiteRule(hostname) {
  const rules = await getSiteRules();
  delete rules[hostname];
  await set({ [SITE_RULES_KEY]: rules });
}

/**
 * 清空所有网站规则
 * @returns {Promise<void>}
 */
export async function clearSiteRules() {
  await set({ [SITE_RULES_KEY]: {} });
}

