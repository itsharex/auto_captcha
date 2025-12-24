/**
 * 验证码检测器模块
 * 自动检测网页中的验证码图片元素
 */

import * as logger from '../utils/logger.js';

// 验证码元素特征
const CAPTCHA_PATTERNS = {
    // 类名关键词
    classKeywords: [
        'captcha', 'verify', 'code', 'vcode', 'imgcode',
        'checkcode', 'seccode', 'authcode', 'validcode',
        'yzm', 'yanzhengma', '验证码'
    ],

    // ID关键词
    idKeywords: [
        'captcha', 'verify', 'code', 'vcode', 'imgcode',
        'checkcode', 'seccode', 'authcode', 'validcode',
        'yzm', 'captchaImg', 'codeImg'
    ],

    // 常见验证码图片尺寸范围
    sizeRange: {
        minWidth: 50,
        maxWidth: 300,
        minHeight: 20,
        maxHeight: 100
    },

    // 输入框类名/ID关键词
    inputKeywords: [
        'captcha', 'verify', 'code', 'vcode',
        'checkcode', 'seccode', 'authcode', 'validcode',
        'yzm', 'yanzhengma', '验证码'
    ]
};

/**
 * 验证码检测器类
 */
export class CaptchaDetector {
    constructor() {
        this.detectedCaptchas = [];
        this.observers = [];
    }

    /**
     * 扫描页面查找验证码元素
     * @returns {Array} - 检测到的验证码信息
     */
    scan() {
        logger.debug('开始扫描页面验证码');

        this.detectedCaptchas = [];

        // 扫描img元素
        this.scanImages();

        // 扫描canvas元素
        this.scanCanvas();

        // 扫描svg元素
        this.scanSvg();

        logger.info(`扫描完成，找到 ${this.detectedCaptchas.length} 个可能的验证码`);

        return this.detectedCaptchas;
    }

    /**
     * 扫描img元素
     */
    scanImages() {
        const images = document.querySelectorAll('img');

        images.forEach((img, index) => {
            if (this.isLikelyCaptcha(img)) {
                const captchaInfo = {
                    type: 'image',
                    element: img,
                    src: img.src,
                    rect: img.getBoundingClientRect(),
                    confidence: this.calculateConfidence(img),
                    inputElement: this.findRelatedInput(img),
                    id: `captcha-${index}`
                };

                this.detectedCaptchas.push(captchaInfo);
                logger.debug('找到可能的验证码图片', captchaInfo);
            }
        });
    }

    /**
     * 扫描canvas元素
     */
    scanCanvas() {
        const canvases = document.querySelectorAll('canvas');

        canvases.forEach((canvas, index) => {
            if (this.isLikelyCanvasCaptcha(canvas)) {
                const captchaInfo = {
                    type: 'canvas',
                    element: canvas,
                    rect: canvas.getBoundingClientRect(),
                    confidence: this.calculateConfidence(canvas),
                    inputElement: this.findRelatedInput(canvas),
                    id: `captcha-canvas-${index}`
                };

                this.detectedCaptchas.push(captchaInfo);
                logger.debug('找到可能的Canvas验证码', captchaInfo);
            }
        });
    }

    /**
     * 扫描svg元素
     */
    scanSvg() {
        const svgs = document.querySelectorAll('svg');

        svgs.forEach((svg, index) => {
            if (this.isLikelySvgCaptcha(svg)) {
                const captchaInfo = {
                    type: 'svg',
                    element: svg,
                    rect: svg.getBoundingClientRect(),
                    confidence: this.calculateConfidence(svg),
                    inputElement: this.findRelatedInput(svg),
                    id: `captcha-svg-${index}`
                };

                this.detectedCaptchas.push(captchaInfo);
                logger.debug('找到可能的SVG验证码', captchaInfo);
            }
        });
    }

    /**
     * 判断img元素是否可能是验证码
     * @param {HTMLImageElement} img
     * @returns {boolean}
     */
    isLikelyCaptcha(img) {
        // 检查尺寸
        const rect = img.getBoundingClientRect();
        if (!this.isCaptchaSize(rect.width, rect.height)) {
            return false;
        }

        // 检查是否可见
        if (!this.isVisible(img)) {
            return false;
        }

        // 检查类名和ID
        if (this.matchesKeywords(img)) {
            return true;
        }

        // 检查src中的关键词
        if (this.srcContainsKeywords(img.src)) {
            return true;
        }

        // 检查alt属性
        if (this.matchesKeywordsInText(img.alt)) {
            return true;
        }

        // 检查父元素
        if (this.parentContainsKeywords(img)) {
            return true;
        }

        // 检查附近是否有验证码输入框
        if (this.hasNearbyInput(img)) {
            return true;
        }

        return false;
    }

    /**
     * 判断canvas元素是否可能是验证码
     * @param {HTMLCanvasElement} canvas
     * @returns {boolean}
     */
    isLikelyCanvasCaptcha(canvas) {
        const rect = canvas.getBoundingClientRect();

        if (!this.isCaptchaSize(rect.width, rect.height)) {
            return false;
        }

        if (!this.isVisible(canvas)) {
            return false;
        }

        if (this.matchesKeywords(canvas)) {
            return true;
        }

        if (this.parentContainsKeywords(canvas)) {
            return true;
        }

        if (this.hasNearbyInput(canvas)) {
            return true;
        }

        return false;
    }

    /**
     * 判断svg元素是否可能是验证码
     * @param {SVGElement} svg
     * @returns {boolean}
     */
    isLikelySvgCaptcha(svg) {
        const rect = svg.getBoundingClientRect();

        if (!this.isCaptchaSize(rect.width, rect.height)) {
            return false;
        }

        if (!this.isVisible(svg)) {
            return false;
        }

        if (this.matchesKeywords(svg)) {
            return true;
        }

        if (this.parentContainsKeywords(svg)) {
            return true;
        }

        if (this.hasNearbyInput(svg)) {
            return true;
        }

        return false;
    }

    /**
     * 检查尺寸是否符合验证码特征
     * @param {number} width
     * @param {number} height
     * @returns {boolean}
     */
    isCaptchaSize(width, height) {
        const { minWidth, maxWidth, minHeight, maxHeight } = CAPTCHA_PATTERNS.sizeRange;
        return width >= minWidth && width <= maxWidth &&
            height >= minHeight && height <= maxHeight;
    }

    /**
     * 检查元素是否可见
     * @param {Element} element
     * @returns {boolean}
     */
    isVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;
    }

    /**
     * 检查元素的类名和ID是否匹配关键词
     * @param {Element} element
     * @returns {boolean}
     */
    matchesKeywords(element) {
        const className = (element.className || '').toLowerCase();
        const id = (element.id || '').toLowerCase();

        const matchClass = CAPTCHA_PATTERNS.classKeywords.some(
            keyword => className.includes(keyword)
        );

        const matchId = CAPTCHA_PATTERNS.idKeywords.some(
            keyword => id.includes(keyword)
        );

        return matchClass || matchId;
    }

    /**
     * 检查文本是否包含关键词
     * @param {string} text
     * @returns {boolean}
     */
    matchesKeywordsInText(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return CAPTCHA_PATTERNS.classKeywords.some(
            keyword => lowerText.includes(keyword)
        );
    }

    /**
     * 检查src是否包含关键词
     * @param {string} src
     * @returns {boolean}
     */
    srcContainsKeywords(src) {
        if (!src) return false;
        const lowerSrc = src.toLowerCase();
        return CAPTCHA_PATTERNS.classKeywords.some(
            keyword => lowerSrc.includes(keyword)
        );
    }

    /**
     * 检查父元素是否包含关键词
     * @param {Element} element
     * @returns {boolean}
     */
    parentContainsKeywords(element) {
        let parent = element.parentElement;
        let depth = 0;
        const maxDepth = 3;

        while (parent && depth < maxDepth) {
            if (this.matchesKeywords(parent)) {
                return true;
            }
            parent = parent.parentElement;
            depth++;
        }

        return false;
    }

    /**
     * 检查附近是否有输入框
     * @param {Element} element
     * @returns {boolean}
     */
    hasNearbyInput(element) {
        return this.findRelatedInput(element) !== null;
    }

    /**
     * 查找关联的输入框
     * @param {Element} element
     * @returns {HTMLInputElement|null}
     */
    findRelatedInput(element) {
        // 策略1: 在父容器内查找
        let parent = element.parentElement;
        let depth = 0;
        const maxDepth = 5;

        while (parent && depth < maxDepth) {
            const input = this.findCaptchaInput(parent);
            if (input) {
                return input;
            }
            parent = parent.parentElement;
            depth++;
        }

        // 策略2: 在相邻元素中查找
        const rect = element.getBoundingClientRect();
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');

        for (const input of inputs) {
            const inputRect = input.getBoundingClientRect();
            const distance = Math.abs(inputRect.top - rect.top) + Math.abs(inputRect.left - rect.right);

            // 如果输入框在验证码右侧或下方100px范围内
            if (distance < 200 && this.isCaptchaInputByName(input)) {
                return input;
            }
        }

        // 策略3: 按位置查找最近的输入框
        for (const input of inputs) {
            const inputRect = input.getBoundingClientRect();

            // 输入框在验证码右侧
            if (inputRect.left > rect.right &&
                inputRect.left - rect.right < 150 &&
                Math.abs(inputRect.top - rect.top) < 50) {
                return input;
            }

            // 输入框在验证码下方
            if (inputRect.top > rect.bottom &&
                inputRect.top - rect.bottom < 100 &&
                Math.abs(inputRect.left - rect.left) < 100) {
                return input;
            }
        }

        return null;
    }

    /**
     * 在容器内查找验证码输入框
     * @param {Element} container
     * @returns {HTMLInputElement|null}
     */
    findCaptchaInput(container) {
        const inputs = container.querySelectorAll('input[type="text"], input:not([type])');

        for (const input of inputs) {
            if (this.isCaptchaInputByName(input)) {
                return input;
            }
        }

        return null;
    }

    /**
     * 根据输入框名称判断是否是验证码输入框
     * @param {HTMLInputElement} input
     * @returns {boolean}
     */
    isCaptchaInputByName(input) {
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        const className = (input.className || '').toLowerCase();

        return CAPTCHA_PATTERNS.inputKeywords.some(keyword =>
            name.includes(keyword) ||
            id.includes(keyword) ||
            placeholder.includes(keyword) ||
            className.includes(keyword)
        );
    }

    /**
     * 计算置信度
     * @param {Element} element
     * @returns {number} - 0-100
     */
    calculateConfidence(element) {
        let score = 0;

        // 类名/ID匹配 +30
        if (this.matchesKeywords(element)) {
            score += 30;
        }

        // src关键词 +20
        if (element.src && this.srcContainsKeywords(element.src)) {
            score += 20;
        }

        // 父元素匹配 +15
        if (this.parentContainsKeywords(element)) {
            score += 15;
        }

        // 有关联输入框 +25
        if (this.findRelatedInput(element)) {
            score += 25;
        }

        // 尺寸合理 +10
        const rect = element.getBoundingClientRect();
        if (this.isCaptchaSize(rect.width, rect.height)) {
            score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * 捕获验证码图像
     * @param {object} captchaInfo - 验证码信息
     * @returns {Promise<string>} - Base64图像数据
     */
    async captureImage(captchaInfo) {
        logger.debug('捕获验证码图像', { type: captchaInfo.type });

        switch (captchaInfo.type) {
            case 'image':
                return this.captureImgElement(captchaInfo.element);
            case 'canvas':
                return this.captureCanvasElement(captchaInfo.element);
            case 'svg':
                return this.captureSvgElement(captchaInfo.element);
            default:
                throw new Error(`不支持的验证码类型: ${captchaInfo.type}`);
        }
    }

    /**
     * 捕获img元素
     * @param {HTMLImageElement} img
     * @returns {Promise<string>}
     */
    async captureImgElement(img) {
        return new Promise((resolve, reject) => {
            // 如果是跨域图片，需要特殊处理
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 创建新图片以处理跨域
            const newImg = new Image();
            newImg.crossOrigin = 'anonymous';

            newImg.onload = () => {
                canvas.width = newImg.naturalWidth || newImg.width;
                canvas.height = newImg.naturalHeight || newImg.height;
                ctx.drawImage(newImg, 0, 0);

                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    // 如果跨域失败，尝试直接返回src
                    if (img.src.startsWith('data:')) {
                        resolve(img.src);
                    } else {
                        reject(new Error('无法捕获跨域图片'));
                    }
                }
            };

            newImg.onerror = () => {
                // 尝试使用原始src
                if (img.src.startsWith('data:')) {
                    resolve(img.src);
                } else {
                    reject(new Error('图片加载失败'));
                }
            };

            // 添加时间戳避免缓存
            const srcWithTimestamp = img.src.includes('?')
                ? `${img.src}&_t=${Date.now()}`
                : `${img.src}?_t=${Date.now()}`;

            newImg.src = srcWithTimestamp;
        });
    }

    /**
     * 捕获canvas元素
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<string>}
     */
    async captureCanvasElement(canvas) {
        return canvas.toDataURL('image/png');
    }

    /**
     * 捕获svg元素
     * @param {SVGElement} svg
     * @returns {Promise<string>}
     */
    async captureSvgElement(svg) {
        return new Promise((resolve, reject) => {
            try {
                // 克隆SVG
                const clonedSvg = svg.cloneNode(true);

                // 获取尺寸
                const rect = svg.getBoundingClientRect();
                clonedSvg.setAttribute('width', rect.width);
                clonedSvg.setAttribute('height', rect.height);

                // 序列化SVG
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);

                // 创建Blob
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);

                // 转换为PNG
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = rect.width;
                    canvas.height = rect.height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    URL.revokeObjectURL(url);
                    resolve(canvas.toDataURL('image/png'));
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('SVG转换失败'));
                };

                img.src = url;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 高亮显示验证码元素
     * @param {object} captchaInfo - 验证码信息
     */
    highlight(captchaInfo) {
        const element = captchaInfo.element;
        element.style.outline = '3px solid #4CAF50';
        element.style.outlineOffset = '2px';
    }

    /**
     * 取消高亮
     * @param {object} captchaInfo - 验证码信息
     */
    unhighlight(captchaInfo) {
        const element = captchaInfo.element;
        element.style.outline = '';
        element.style.outlineOffset = '';
    }

    /**
     * 获取检测到的验证码列表
     * @returns {Array}
     */
    getDetectedCaptchas() {
        return this.detectedCaptchas;
    }

    /**
     * 获取最可能的验证码
     * @returns {object|null}
     */
    getMostLikelyCaptcha() {
        if (this.detectedCaptchas.length === 0) {
            return null;
        }

        return this.detectedCaptchas.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        );
    }
}

export default CaptchaDetector;
