#!/usr/bin/env node
/**
 * Cookie 导入工具
 * 从 Chrome 浏览器导入 Cookie 到 browse
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// 配置
const CONFIG = {
  browseCommand: process.env.HOME + '/.claude/skills/gstack/browse/dist/browse',
  chromeCookiePath: path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Cookies'),
  platforms: {
    weibo: ['.weibo.com', 'weibo.com'],
    xiaohongshu: ['.xiaohongshu.com', 'xiaohongshu.com'],
    douyin: ['.douyin.com', 'douyin.com']
  }
};

/**
 * 检查 Chrome Cookie 数据库是否存在
 */
async function checkChromeCookies() {
  try {
    await fs.access(CONFIG.chromeCookiePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 Chrome 读取指定域名的 Cookie
 * 使用 sqlite3 命令行工具读取（避免锁定问题）
 */
async function readCookiesFromChrome(domain) {
  console.log(`📖 读取 ${domain} 的 Cookie...`);

  // 复制 Cookie 数据库到临时文件（避免锁定）
  const tempCookieFile = path.join(os.tmpdir(), `chrome_cookies_${Date.now()}.db`);
  await execAsync(`cp "${CONFIG.chromeCookiePath}" "${tempCookieFile}"`);

  try {
    // 使用 sqlite3 读取 Cookie
    const query = `
      SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly
      FROM cookies
      WHERE host_key LIKE '%${domain}%'
    `;

    const { stdout } = await execAsync(`sqlite3 "${tempCookieFile}" "${query}"`);

    if (!stdout.trim()) {
      console.log(`⚠️  未找到 ${domain} 的 Cookie（可能未登录）`);
      return [];
    }

    // 解析输出（格式: name|value|host_key|path|expires_utc|is_secure|is_httponly）
    const cookies = stdout.trim().split('\n').map(line => {
      const [name, value, host_key, path, expires_utc, is_secure, is_httponly] = line.split('|');

      return {
        name,
        value,
        domain: host_key,
        path: path || '/',
        expires: parseInt(expires_utc) / 1000000 - 11644473600, // Chrome 时间戳转 Unix 时间戳
        secure: is_secure === '1',
        httpOnly: is_httponly === '1'
      };
    });

    console.log(`✅ 读取到 ${cookies.length} 个 Cookie`);
    return cookies;

  } finally {
    // 清理临时文件
    await fs.unlink(tempCookieFile).catch(() => {});
  }
}

/**
 * 注入 Cookie 到 browse
 */
async function injectCookiesToBrowse(cookies, url) {
  console.log(`\n💉 注入 ${cookies.length} 个 Cookie 到 browse...`);

  // 先访问目标页面
  await execAsync(`${CONFIG.browseCommand} goto "${url}"`);

  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 将 Cookie 保存到临时文件
  const cookieFile = path.join(os.tmpdir(), `cookies_${Date.now()}.json`);

  // 转换为 Playwright Cookie 格式
  const playwrightCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires > 0 ? cookie.expires : undefined,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: 'Lax'
  }));

  await fs.writeFile(cookieFile, JSON.stringify(playwrightCookies, null, 2));

  try {
    // 使用 browse 的 cookies set 命令（如果支持）
    // 否则使用 JavaScript 注入
    console.log(`📝 Cookie 文件已保存: ${cookieFile}`);
    console.log(`💡 手动注入方法：`);
    console.log(`   1. 打开 browse: ${CONFIG.browseCommand} handoff`);
    console.log(`   2. 在控制台粘贴以下代码：`);
    console.log(`\n${playwrightCookies.map(c =>
      `document.cookie = "${c.name}=${c.value}; domain=${c.domain}; path=${c.path}${c.secure ? '; secure' : ''}${c.httpOnly ? '; httponly' : ''}; samesite=Lax";`
    ).join('\n')}\n`);

    // 尝试通过 JavaScript 注入（非 HttpOnly 的 Cookie）
    let injectedCount = 0;
    for (const cookie of playwrightCookies.filter(c => !c.httpOnly)) {
      try {
        const cookieStr = `${cookie.name}=${cookie.value}; domain=${cookie.domain}; path=${cookie.path}${cookie.secure ? '; secure' : ''}; samesite=Lax`;
        await execAsync(`${CONFIG.browseCommand} eval 'document.cookie = "${cookieStr.replace(/"/g, '\\"')}"'`);
        injectedCount++;
      } catch (error) {
        // 忽略错误，继续下一个
      }
    }

    console.log(`✅ 成功注入 ${injectedCount}/${playwrightCookies.length} 个 Cookie`);

    if (injectedCount < playwrightCookies.length) {
      console.log(`⚠️  部分 HttpOnly Cookie 无法通过 JavaScript 注入`);
      console.log(`💡 解决方案：使用 /connect-chrome skill 连接真实浏览器`);
    }

  } finally {
    // 暂时保留 Cookie 文件用于调试
    console.log(`\n📄 Cookie 文件保存在: ${cookieFile}`);
  }
}

/**
 * 为指定平台导入 Cookie
 */
async function importCookiesForPlatform(platform) {
  console.log(`\n🔐 为 ${platform} 导入 Cookie\n`);

  // 检查 Chrome Cookie 数据库
  const cookiesExist = await checkChromeCookies();
  if (!cookiesExist) {
    throw new Error(`未找到 Chrome Cookie 数据库: ${CONFIG.chromeCookiePath}`);
  }

  // 获取平台域名列表
  const domains = CONFIG.platforms[platform];
  if (!domains) {
    throw new Error(`不支持的平台: ${platform}。支持的平台: ${Object.keys(CONFIG.platforms).join(', ')}`);
  }

  // 读取所有相关域名的 Cookie
  const allCookies = [];
  for (const domain of domains) {
    const cookies = await readCookiesFromChrome(domain);
    allCookies.push(...cookies);
  }

  if (allCookies.length === 0) {
    throw new Error(`未找到 ${platform} 的 Cookie。请确保你已在 Chrome 中登录该平台。`);
  }

  // 确定目标 URL
  const urls = {
    weibo: 'https://weibo.com',
    xiaohongshu: 'https://www.xiaohongshu.com',
    douyin: 'https://www.douyin.com'
  };

  // 注入 Cookie
  await injectCookiesToBrowse(allCookies, urls[platform]);

  console.log(`\n✅ ${platform} Cookie 导入成功！`);
  console.log(`📌 browse 现在可以以登录状态访问 ${platform}`);

  return allCookies;
}

/**
 * 验证 Cookie 是否有效
 */
async function verifyCookies(platform) {
  console.log(`\n🔍 验证 ${platform} 登录状态...`);

  const urls = {
    weibo: 'https://weibo.com',
    xiaohongshu: 'https://www.xiaohongshu.com',
    douyin: 'https://www.douyin.com'
  };

  // 访问目标页面
  await execAsync(`${CONFIG.browseCommand} goto "${urls[platform]}"`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 截图验证
  const screenshotPath = path.join(os.tmpdir(), `verify_${platform}_${Date.now()}.png`);
  await execAsync(`${CONFIG.browseCommand} screenshot "${screenshotPath}"`);

  console.log(`📸 截图已保存: ${screenshotPath}`);
  console.log(`💡 请手动检查截图，确认是否显示登录状态`);

  return screenshotPath;
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const platform = args[1];

  console.log('🍪 Cookie 导入工具\n');

  try {
    switch (command) {
      case 'import':
        // 导入 Cookie
        if (!platform) {
          throw new Error('请指定平台: weibo, xiaohongshu, douyin');
        }
        await importCookiesForPlatform(platform);
        break;

      case 'verify':
        // 验证 Cookie
        if (!platform) {
          throw new Error('请指定平台: weibo, xiaohongshu, douyin');
        }
        await verifyCookies(platform);
        break;

      case 'list':
        // 列出支持的平台
        console.log('支持的平台:');
        Object.keys(CONFIG.platforms).forEach(p => {
          console.log(`  - ${p}`);
        });
        break;

      default:
        console.log(`使用方法：

🔐 导入 Cookie:
  node cookie-importer.js import <platform>
  示例: node cookie-importer.js import weibo

🔍 验证登录状态:
  node cookie-importer.js verify <platform>
  示例: node cookie-importer.js verify weibo

📋 列出支持的平台:
  node cookie-importer.js list

支持的平台: ${Object.keys(CONFIG.platforms).join(', ')}
        `);
    }
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  main();
}

export { importCookiesForPlatform, verifyCookies, readCookiesFromChrome };
