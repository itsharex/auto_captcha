/**
 * 加密工具模块
 * 使用Web Crypto API进行API密钥加密/解密
 */

// 加密算法配置
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

// 用于派生密钥的盐（每个扩展实例固定）
let cachedKey = null;

/**
 * 获取或生成加密密钥
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey() {
    if (cachedKey) {
        return cachedKey;
    }

    // 尝试从存储中获取密钥材料
    const result = await new Promise((resolve) => {
        chrome.storage.local.get('_encryption_key_material', resolve);
    });

    let keyMaterial;

    if (result._encryption_key_material) {
        // 使用已存储的密钥材料
        keyMaterial = new Uint8Array(result._encryption_key_material);
    } else {
        // 生成新的密钥材料
        keyMaterial = crypto.getRandomValues(new Uint8Array(32));
        await new Promise((resolve) => {
            chrome.storage.local.set({
                _encryption_key_material: Array.from(keyMaterial)
            }, resolve);
        });
    }

    // 从密钥材料派生密钥
    const importedKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    // 使用PBKDF2派生AES密钥
    const salt = new TextEncoder().encode('ai-captcha-solver-salt');
    cachedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        importedKey,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );

    return cachedKey;
}

/**
 * 加密字符串
 * @param {string} plaintext - 明文
 * @returns {Promise<string>} - Base64编码的密文
 */
export async function encrypt(plaintext) {
    if (!plaintext) return '';

    try {
        const key = await getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const encodedText = new TextEncoder().encode(plaintext);

        const ciphertext = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            key,
            encodedText
        );

        // 将IV和密文合并，然后Base64编码
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);

        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('加密失败:', error);
        throw new Error('加密失败');
    }
}

/**
 * 解密字符串
 * @param {string} ciphertext - Base64编码的密文
 * @returns {Promise<string>} - 明文
 */
export async function decrypt(ciphertext) {
    if (!ciphertext) return '';

    try {
        const key = await getEncryptionKey();

        // Base64解码
        const combined = new Uint8Array(
            atob(ciphertext).split('').map(c => c.charCodeAt(0))
        );

        // 分离IV和密文
        const iv = combined.slice(0, IV_LENGTH);
        const data = combined.slice(IV_LENGTH);

        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            key,
            data
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('解密失败:', error);
        throw new Error('解密失败');
    }
}

/**
 * 重置加密密钥（慎用，会导致已加密数据无法解密）
 * @returns {Promise<void>}
 */
export async function resetEncryptionKey() {
    cachedKey = null;
    await new Promise((resolve) => {
        chrome.storage.local.remove('_encryption_key_material', resolve);
    });
}
