/**
 * Service Worker 后台服务
 * 管理扩展生命周期，协调内容脚本与API通信
 */

import { apiManager } from '../api/api-manager.js';
import * as storage from '../utils/storage.js';
import * as logger from '../utils/logger.js';

// 初始化
logger.info('Service Worker 启动');

// 监听安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
    logger.info('扩展安装/更新', { reason: details.reason });

    if (details.reason === 'install') {
        // 首次安装，初始化默认设置
        await storage.saveSettings(storage.DEFAULT_SETTINGS);

        // 打开设置页面
        chrome.runtime.openOptionsPage();
    }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('收到消息', { action: message.action, sender: sender.tab?.id });

    handleMessage(message, sender, sendResponse);

    // 返回true表示异步响应
    return true;
});

/**
 * 处理消息
 * @param {object} message - 消息
 * @param {object} sender - 发送者
 * @param {Function} sendResponse - 响应函数
 */
async function handleMessage(message, sender, sendResponse) {
    try {
        switch (message.action) {
            case 'recognizeCaptcha':
                await handleRecognizeCaptcha(message, sendResponse);
                break;

            case 'testConnection':
                await handleTestConnection(message, sendResponse);
                break;

            case 'getActiveConfig':
                await handleGetActiveConfig(sendResponse);
                break;

            case 'getSettings':
                await handleGetSettings(sendResponse);
                break;

            case 'getStats':
                await handleGetStats(sendResponse);
                break;

            case 'getHistory':
                await handleGetHistory(message, sendResponse);
                break;

            case 'captchaDetected':
                handleCaptchaDetected(message, sender);
                sendResponse({ success: true });
                break;

            // 网站规则相关
            case 'getSiteRule':
                await handleGetSiteRule(message, sendResponse);
                break;

            case 'saveSiteRule':
                await handleSaveSiteRule(message, sendResponse);
                break;

            case 'deleteSiteRule':
                await handleDeleteSiteRule(message, sendResponse);
                break;

            default:
                sendResponse({ success: false, error: '未知操作' });
        }
    } catch (error) {
        logger.error('处理消息失败', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 处理验证码识别请求
 * @param {object} message - 消息
 * @param {Function} sendResponse - 响应函数
 */
async function handleRecognizeCaptcha(message, sendResponse) {
    const { imageData } = message;

    if (!imageData) {
        sendResponse({ success: false, error: '缺少图像数据' });
        return;
    }

    logger.info('开始识别验证码');

    const result = await apiManager.recognize(imageData);

    sendResponse(result);
}

/**
 * 处理连接测试请求
 * @param {object} message - 消息
 * @param {Function} sendResponse - 响应函数
 */
async function handleTestConnection(message, sendResponse) {
    const { config } = message;

    if (!config) {
        sendResponse({ success: false, error: '缺少配置信息' });
        return;
    }

    logger.info('测试API连接');

    const result = await apiManager.testConnection(config);

    sendResponse(result);
}

/**
 * 处理获取活跃配置请求
 * @param {Function} sendResponse - 响应函数
 */
async function handleGetActiveConfig(sendResponse) {
    const config = await storage.getActiveConfig();

    // 隐藏API密钥
    if (config) {
        config.apiKey = config.apiKey ? '******' : '';
    }

    sendResponse({ success: true, config });
}

/**
 * 处理获取设置请求
 * @param {Function} sendResponse - 响应函数
 */
async function handleGetSettings(sendResponse) {
    const settings = await storage.getSettings();
    sendResponse({ success: true, settings });
}

/**
 * 处理获取统计数据请求
 * @param {Function} sendResponse - 响应函数
 */
async function handleGetStats(sendResponse) {
    const stats = await storage.getStats();
    sendResponse({ success: true, stats });
}

/**
 * 处理获取历史记录请求
 * @param {object} message - 消息
 * @param {Function} sendResponse - 响应函数
 */
async function handleGetHistory(message, sendResponse) {
    const limit = message.limit || 50;
    const history = await storage.getHistory(limit);
    sendResponse({ success: true, history });
}

/**
 * 处理验证码检测通知
 * @param {object} message - 消息
 * @param {object} sender - 发送者
 */
function handleCaptchaDetected(message, sender) {
    const { count, bestConfidence } = message;

    logger.debug('收到验证码检测通知', { count, bestConfidence, tabId: sender.tab?.id });

    // 更新扩展图标徽章
    if (sender.tab?.id) {
        if (count > 0) {
            chrome.action.setBadgeText({
                tabId: sender.tab.id,
                text: count.toString()
            });
            chrome.action.setBadgeBackgroundColor({
                tabId: sender.tab.id,
                color: bestConfidence > 50 ? '#4CAF50' : '#FFA726'
            });
        } else {
            chrome.action.setBadgeText({
                tabId: sender.tab.id,
                text: ''
            });
        }
    }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
        // 清除徽章
        chrome.action.setBadgeText({ tabId, text: '' });
    }
});

// ==================== 网站规则处理 ====================

/**
 * 获取网站规则
 */
async function handleGetSiteRule(message, sendResponse) {
    const { hostname } = message;

    if (!hostname) {
        sendResponse({ success: false, error: '缺少域名' });
        return;
    }

    const rule = await storage.getSiteRule(hostname);
    sendResponse({ success: true, rule });
}

/**
 * 保存网站规则
 */
async function handleSaveSiteRule(message, sendResponse) {
    const { hostname, rule } = message;

    if (!hostname || !rule) {
        sendResponse({ success: false, error: '缺少参数' });
        return;
    }

    await storage.saveSiteRule(hostname, rule);
    logger.info('已保存网站规则', { hostname, selector: rule.selector });
    sendResponse({ success: true });
}

/**
 * 删除网站规则
 */
async function handleDeleteSiteRule(message, sendResponse) {
    const { hostname } = message;

    if (!hostname) {
        sendResponse({ success: false, error: '缺少域名' });
        return;
    }

    await storage.deleteSiteRule(hostname);
    logger.info('已删除网站规则', { hostname });
    sendResponse({ success: true });
}

logger.info('Service Worker 初始化完成');

