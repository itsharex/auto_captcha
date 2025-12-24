/**
 * 日志系统模块
 * 提供分级日志记录和调试模式支持
 */

// 日志级别
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// 当前日志级别
let currentLevel = LOG_LEVELS.INFO;

// 日志前缀
const PREFIX = '[AI Captcha]';

// 颜色配置
const COLORS = {
    DEBUG: '#7f8c8d',
    INFO: '#3498db',
    WARN: '#f39c12',
    ERROR: '#e74c3c'
};

/**
 * 设置日志级别
 * @param {number} level - 日志级别
 */
export function setLevel(level) {
    currentLevel = level;
}

/**
 * 启用调试模式
 */
export function enableDebug() {
    currentLevel = LOG_LEVELS.DEBUG;
}

/**
 * 禁用调试模式
 */
export function disableDebug() {
    currentLevel = LOG_LEVELS.INFO;
}

/**
 * 格式化日志消息
 * @param {string} level - 日志级别名称
 * @param {string} message - 消息
 * @param {any[]} args - 额外参数
 * @returns {Array}
 */
function formatMessage(level, message, args) {
    const timestamp = new Date().toISOString().substr(11, 12);
    return [
        `%c${PREFIX} %c${timestamp} %c[${level}]%c ${message}`,
        'color: #9b59b6; font-weight: bold',
        'color: #95a5a6',
        `color: ${COLORS[level]}; font-weight: bold`,
        'color: inherit',
        ...args
    ];
}

/**
 * 调试日志
 * @param {string} message - 消息
 * @param {...any} args - 额外参数
 */
export function debug(message, ...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.log(...formatMessage('DEBUG', message, args));
    }
}

/**
 * 信息日志
 * @param {string} message - 消息
 * @param {...any} args - 额外参数
 */
export function info(message, ...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
        console.log(...formatMessage('INFO', message, args));
    }
}

/**
 * 警告日志
 * @param {string} message - 消息
 * @param {...any} args - 额外参数
 */
export function warn(message, ...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
        console.warn(...formatMessage('WARN', message, args));
    }
}

/**
 * 错误日志
 * @param {string} message - 消息
 * @param {...any} args - 额外参数
 */
export function error(message, ...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
        console.error(...formatMessage('ERROR', message, args));
    }
}

/**
 * 分组日志
 * @param {string} label - 分组标签
 * @param {Function} fn - 分组内容函数
 */
export function group(label, fn) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.group(`${PREFIX} ${label}`);
        fn();
        console.groupEnd();
    }
}

/**
 * 表格日志
 * @param {any} data - 表格数据
 */
export function table(data) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.table(data);
    }
}

/**
 * 计时开始
 * @param {string} label - 计时标签
 */
export function time(label) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.time(`${PREFIX} ${label}`);
    }
}

/**
 * 计时结束
 * @param {string} label - 计时标签
 */
export function timeEnd(label) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
        console.timeEnd(`${PREFIX} ${label}`);
    }
}

// 导出默认日志对象
export default {
    LOG_LEVELS,
    setLevel,
    enableDebug,
    disableDebug,
    debug,
    info,
    warn,
    error,
    group,
    table,
    time,
    timeEnd
};
