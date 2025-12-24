/**
 * Anthropic Claude 适配器
 * 支持 Claude API 格式（包括自建转发服务）
 */

import * as logger from '../utils/logger.js';

/**
 * Claude API适配器
 */
export class ClaudeAdapter {
    /**
     * 构造函数
     * @param {object} config - API配置
     */
    constructor(config) {
        this.config = {
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 1024,
            ...config
        };

        // 确保baseUrl没有尾部斜杠
        this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    }

    /**
     * 构建请求头
     * @returns {object}
     */
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        };

        // 添加API密钥
        if (this.config.apiKey) {
            headers['x-api-key'] = this.config.apiKey;
        }

        // 添加自定义请求头
        if (this.config.customHeaders) {
            Object.assign(headers, this.config.customHeaders);
        }

        return headers;
    }

    /**
     * 识别验证码
     * @param {string} imageData - Base64编码的图像数据
     * @param {string} prompt - 识别提示词
     * @returns {Promise<object>} - 识别结果
     */
    async recognize(imageData, prompt) {
        logger.debug('Claude适配器开始识别');

        // 处理图像数据 - 提取 base64 和 media_type
        let base64Data = imageData;
        let mediaType = 'image/png';

        if (imageData.startsWith('data:')) {
            const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mediaType = match[1];
                base64Data = match[2];
            }
        }

        const requestBody = {
            model: this.config.model,
            max_tokens: this.config.maxTokens || 1024,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Data
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }
            ]
        };

        const url = `${this.config.baseUrl}/v1/messages`;

        logger.debug('请求配置', {
            url,
            model: this.config.model
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        // 解析Claude响应
        if (!data.content || data.content.length === 0) {
            throw new Error('API返回结果为空');
        }

        // 找到text类型的内容
        const textContent = data.content.find(c => c.type === 'text');
        const text = textContent?.text?.trim() || '';

        if (!text) {
            throw new Error('识别结果为空');
        }

        logger.debug('识别完成', { text });

        return {
            text,
            raw: data
        };
    }

    /**
     * 测试连接
     * @returns {Promise<object>}
     */
    async testConnection() {
        logger.debug('Claude适配器测试连接');

        const requestBody = {
            model: this.config.model,
            max_tokens: 50,
            messages: [
                {
                    role: 'user',
                    content: 'Hi, please respond with "OK" to confirm the connection.'
                }
            ]
        };

        const url = `${this.config.baseUrl}/v1/messages`;

        logger.debug('测试连接URL:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        return {
            success: true,
            message: '连接成功',
            model: data.model
        };
    }

    /**
     * 解析错误响应
     * @param {Response} response - HTTP响应
     * @returns {Promise<string>}
     */
    async parseError(response) {
        try {
            const data = await response.json();

            if (data.error?.message) {
                return data.error.message;
            }

            return `HTTP ${response.status}: ${response.statusText}`;
        } catch {
            return `HTTP ${response.status}: ${response.statusText}`;
        }
    }
}

export default ClaudeAdapter;
