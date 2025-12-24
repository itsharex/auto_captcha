/**
 * 自动填充模块
 * 将识别结果填入验证码输入框
 */

import * as logger from '../utils/logger.js';

/**
 * 自动填充类
 */
export class AutoFill {
    constructor() {
        this.lastFilledInput = null;
    }

    /**
     * 填充验证码
     * @param {HTMLInputElement} inputElement - 输入框元素
     * @param {string} text - 要填充的文本
     * @param {object} options - 选项
     * @returns {Promise<boolean>} - 是否成功
     */
    async fill(inputElement, text, options = {}) {
        const {
            simulate = true,  // 是否模拟用户输入
            autoSubmit = false,  // 是否自动提交
            confirmBeforeSubmit = true  // 提交前是否确认
        } = options;

        try {
            logger.info('开始填充验证码', { text, simulate });

            if (!inputElement) {
                throw new Error('未找到输入框');
            }

            // 聚焦输入框
            inputElement.focus();

            // 清空现有内容
            inputElement.value = '';
            this.dispatchEvent(inputElement, 'input');

            if (simulate) {
                // 模拟逐字输入
                await this.simulateTyping(inputElement, text);
            } else {
                // 直接设置值
                inputElement.value = text;
                this.dispatchEvent(inputElement, 'input');
                this.dispatchEvent(inputElement, 'change');
            }

            this.lastFilledInput = inputElement;

            // 高亮输入框表示填充完成
            this.highlightInput(inputElement);

            logger.info('验证码填充完成');

            // 自动提交
            if (autoSubmit) {
                if (confirmBeforeSubmit) {
                    // 等待用户确认
                    const confirmed = await this.showConfirmation(text);
                    if (confirmed) {
                        await this.submitForm(inputElement);
                    }
                } else {
                    await this.submitForm(inputElement);
                }
            }

            return true;
        } catch (error) {
            logger.error('填充失败', error);
            return false;
        }
    }

    /**
     * 模拟用户逐字输入
     * @param {HTMLInputElement} input - 输入框
     * @param {string} text - 文本
     */
    async simulateTyping(input, text) {
        for (const char of text) {
            // 触发keydown
            this.dispatchKeyEvent(input, 'keydown', char);

            // 添加字符
            input.value += char;

            // 触发input事件
            this.dispatchEvent(input, 'input');

            // 触发keyup
            this.dispatchKeyEvent(input, 'keyup', char);

            // 随机延迟模拟真实输入
            await this.delay(50 + Math.random() * 100);
        }

        // 触发change事件
        this.dispatchEvent(input, 'change');

        // 触发blur事件
        this.dispatchEvent(input, 'blur');
    }

    /**
     * 派发事件
     * @param {Element} element - 元素
     * @param {string} eventType - 事件类型
     */
    dispatchEvent(element, eventType) {
        const event = new Event(eventType, {
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
    }

    /**
     * 派发键盘事件
     * @param {Element} element - 元素
     * @param {string} eventType - 事件类型
     * @param {string} key - 按键
     */
    dispatchKeyEvent(element, eventType, key) {
        const event = new KeyboardEvent(eventType, {
            key: key,
            code: `Key${key.toUpperCase()}`,
            charCode: key.charCodeAt(0),
            keyCode: key.charCodeAt(0),
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
    }

    /**
     * 延迟
     * @param {number} ms - 毫秒
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 高亮输入框
     * @param {HTMLInputElement} input - 输入框
     */
    highlightInput(input) {
        const originalBorder = input.style.border;
        const originalBoxShadow = input.style.boxShadow;

        input.style.border = '2px solid #4CAF50';
        input.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';

        // 2秒后恢复
        setTimeout(() => {
            input.style.border = originalBorder;
            input.style.boxShadow = originalBoxShadow;
        }, 2000);
    }

    /**
     * 显示确认对话框
     * @param {string} text - 识别结果
     * @returns {Promise<boolean>}
     */
    async showConfirmation(text) {
        return new Promise((resolve) => {
            // 创建确认对话框
            const overlay = document.createElement('div');
            overlay.id = 'captcha-confirm-overlay';
            overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        max-width: 300px;
        text-align: center;
      `;

            dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #333;">确认提交?</h3>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
          识别结果: <strong style="color: #4CAF50; font-size: 18px;">${text}</strong>
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="captcha-confirm-yes" style="
            padding: 8px 24px;
            border: none;
            border-radius: 6px;
            background: #4CAF50;
            color: white;
            cursor: pointer;
            font-size: 14px;
          ">确认</button>
          <button id="captcha-confirm-no" style="
            padding: 8px 24px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            color: #666;
            cursor: pointer;
            font-size: 14px;
          ">取消</button>
        </div>
      `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 事件处理
            const yesBtn = dialog.querySelector('#captcha-confirm-yes');
            const noBtn = dialog.querySelector('#captcha-confirm-no');

            const cleanup = () => {
                overlay.remove();
            };

            yesBtn.onclick = () => {
                cleanup();
                resolve(true);
            };

            noBtn.onclick = () => {
                cleanup();
                resolve(false);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }

    /**
     * 提交表单
     * @param {HTMLInputElement} input - 输入框
     */
    async submitForm(input) {
        logger.info('尝试提交表单');

        // 查找表单
        const form = input.closest('form');

        if (form) {
            // 触发submit事件
            const submitEvent = new Event('submit', {
                bubbles: true,
                cancelable: true
            });

            const prevented = !form.dispatchEvent(submitEvent);

            if (!prevented) {
                form.submit();
            }
        } else {
            // 尝试查找提交按钮
            const parent = input.parentElement?.parentElement || document;
            const submitBtn = parent.querySelector(
                'button[type="submit"], input[type="submit"], button:not([type])'
            );

            if (submitBtn) {
                submitBtn.click();
            } else {
                logger.warn('未找到提交按钮');
            }
        }
    }

    /**
     * 获取最后填充的输入框
     * @returns {HTMLInputElement|null}
     */
    getLastFilledInput() {
        return this.lastFilledInput;
    }
}

export default AutoFill;
