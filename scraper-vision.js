#!/usr/bin/env node
/**
 * 超级数据 - 视觉抓取工具
 * 基于 browse (无头浏览器) + Claude 视觉API
 *
 * 优势：
 * - 绕过HTML反爬（直接分析截图）
 * - 不依赖DOM结构（页面改版也能用）
 * - 多模态理解（图片+文字+布局）
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const execAsync = promisify(exec);

// 配置
const CONFIG = {
  outputDir: './data',
  browseCommand: process.env.HOME + '/.claude/skills/gstack/browse/dist/browse',
  tempDir: '/tmp/scraper-vision'
};

// 初始化Claude客户端
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

/**
 * 确保browse可用
 */
async function ensureBrowse() {
  try {
    await execAsync(`${CONFIG.browseCommand} status`);
    return true;
  } catch (error) {
    console.error('❌ browse未运行，请先启动browse');
    return false;
  }
}

/**
 * 使用browse截图
 */
async function captureScreenshot(url) {
  await fs.mkdir(CONFIG.tempDir, { recursive: true });

  const timestamp = Date.now();
  const screenshotPath = path.join(CONFIG.tempDir, `screenshot_${timestamp}.png`);

  console.log(`📸 访问并截图: ${url}`);

  // 导航到URL
  await execAsync(`${CONFIG.browseCommand} goto "${url}"`);

  // 等待页面加载
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 截图
  await execAsync(`${CONFIG.browseCommand} screenshot "${screenshotPath}"`);

  console.log(`✅ 截图已保存: ${screenshotPath}`);
  return screenshotPath;
}

/**
 * 使用Claude视觉API分析截图
 */
async function analyzeWithClaude(screenshotPath, extractPrompt) {
  console.log(`🤖 Claude正在分析截图...`);

  // 检查并压缩超大图片（Claude API限制：单边最大8000px）
  let finalPath = screenshotPath;
  try {
    const { stdout: sizeInfo } = await execAsync(`sips -g pixelHeight "${screenshotPath}"`);
    const heightMatch = sizeInfo.match(/pixelHeight:\s*(\d+)/);
    if (heightMatch && parseInt(heightMatch[1]) > 8000) {
      console.log(`⚠️  截图高度 ${heightMatch[1]}px 超过限制，正在压缩...`);
      const compressedPath = screenshotPath.replace('.png', '_compressed.png');
      await execAsync(`sips -Z 7900 "${screenshotPath}" --out "${compressedPath}"`);
      finalPath = compressedPath;
      console.log(`✅ 已压缩至合规尺寸`);
    }
  } catch (error) {
    console.warn('⚠️  无法检测图片尺寸，继续使用原图');
  }

  // 读取截图
  const imageData = await fs.readFile(finalPath);
  const base64Image = imageData.toString('base64');

  // 调用Claude API
  const response = await anthropic.messages.create({
    model: 'pa/claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64Image
          }
        },
        {
          type: 'text',
          text: extractPrompt
        }
      ]
    }]
  });

  console.log(`✅ 分析完成`);
  return response.content[0].text;
}

/**
 * 微博搜索抓取
 */
async function scrapeWeibo(keyword, options = {}) {
  const { maxResults = 10 } = options;

  console.log(`\n🔍 抓取微博: ${keyword}`);

  const url = `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}`;

  // 1. 截图
  const screenshotPath = await captureScreenshot(url);

  // 2. 构造提取Prompt
  const extractPrompt = `这是微博搜索结果页面的截图。请提取页面中所有可见的微博内容。

要求：
1. 提取最多${maxResults}条微博
2. 每条微博包含：作者名、内容摘要（前100字）、是否有图片、是否有视频、互动数据（点赞/转发/评论，如果可见）
3. 以JSON数组格式输出，不要包含任何其他文字

JSON格式：
[
  {
    "author": "作者名",
    "content": "微博内容摘要",
    "has_image": true/false,
    "has_video": true/false,
    "likes": "点赞数（如果可见，否则null）",
    "retweets": "转发数（如果可见，否则null）",
    "comments": "评论数（如果可见，否则null）"
  }
]`;

  // 3. 先检测是否是登录页面
  const loginCheckPrompt = `这张截图显示的是什么页面？请回答以下问题：
1. 是否是登录/注册页面？
2. 是否需要用户登录才能查看内容？
3. 页面上是否有"登录"、"注册"、"验证"等相关文字？

请用 JSON 格式回答：
{
  "isLoginPage": true/false,
  "reason": "简短说明"
}`;

  const loginCheck = await analyzeWithClaude(screenshotPath, loginCheckPrompt);

  try {
    let checkJson = loginCheck.trim();
    if (checkJson.startsWith('```')) {
      checkJson = checkJson.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    const checkResult = JSON.parse(checkJson);

    if (checkResult.isLoginPage) {
      console.error(`❌ 微博需要登录: ${checkResult.reason}`);
      throw new Error(`需要登录：${checkResult.reason}。请使用已登录的浏览器 Cookie，或手动登录后再抓取。`);
    }
  } catch (error) {
    if (error.message.includes('需要登录')) {
      throw error;
    }
    // 登录检测失败，继续尝试提取数据
    console.warn('⚠️  登录检测失败，继续尝试提取数据');
  }

  // 4. Claude分析内容
  const result = await analyzeWithClaude(screenshotPath, extractPrompt);

  // 5. 解析JSON
  try {
    // 提取JSON（去除可能的markdown代码块）
    let jsonText = result.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const data = JSON.parse(jsonText);

    // 如果提取到 0 条数据，给出警告
    if (data.length === 0) {
      console.warn('⚠️  未提取到任何数据，可能原因：');
      console.warn('   1. 页面需要登录');
      console.warn('   2. 搜索关键词没有结果');
      console.warn('   3. 页面加载不完整');
    } else {
      console.log(`✅ 成功提取 ${data.length} 条微博`);
    }

    return {
      keyword,
      url,
      timestamp: new Date().toISOString(),
      count: data.length,
      data,
      warning: data.length === 0 ? '未提取到数据，可能需要登录或搜索无结果' : null
    };
  } catch (error) {
    console.error('❌ JSON解析失败:', error.message);
    console.log('原始输出:', result);
    throw error;
  }
}

/**
 * 小红书搜索抓取（需要代理）
 */
async function scrapeXiaohongshu(keyword, options = {}) {
  const { maxResults = 10, proxy = null } = options;

  console.log(`\n📕 抓取小红书: ${keyword}`);

  if (proxy) {
    console.log(`🔀 使用代理: ${proxy}`);
    // TODO: 配置browse使用代理
  }

  const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;

  const screenshotPath = await captureScreenshot(url);

  const extractPrompt = `这是小红书搜索结果页面的截图。请提取页面中所有可见的笔记/帖子。

要求：
1. 提取最多${maxResults}条笔记
2. 每条笔记包含：标题、作者、点赞数、收藏数、评论数（如果可见）
3. 以JSON数组格式输出

JSON格式：
[
  {
    "title": "笔记标题",
    "author": "作者名",
    "likes": "点赞数",
    "collects": "收藏数",
    "comments": "评论数"
  }
]`;

  const result = await analyzeWithClaude(screenshotPath, extractPrompt);

  let jsonText = result.trim().replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  const data = JSON.parse(jsonText);

  console.log(`✅ 成功提取 ${data.length} 条笔记`);
  return {
    keyword,
    url,
    timestamp: new Date().toISOString(),
    count: data.length,
    data
  };
}

/**
 * 交互式处理验证码
 */
async function handleCaptchaInteractive() {
  console.log(`\n🔐 检测到滑块验证`);
  console.log(`📱 正在打开浏览器，请手动完成验证...`);

  // 打开真实浏览器
  await execAsync(`${CONFIG.browseCommand} handoff "请完成抖音滑块验证"`);

  // 等待用户确认
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n✅ 验证完成后按回车继续...', () => {
      rl.close();
      console.log('🔄 继续抓取...');
      resolve(true);
    });
  });
}

/**
 * 抖音搜索抓取（需要处理验证码）
 */
async function scrapeDouyin(keyword, options = {}) {
  const { maxResults = 10, skipCaptchaCheck = false } = options;

  console.log(`\n🎵 抓取抖音: ${keyword}`);
  console.log(`⚠️  注意: 抖音可能需要滑块验证，如遇验证请手动完成`);

  const url = `https://www.douyin.com/search/${encodeURIComponent(keyword)}`;

  const screenshotPath = await captureScreenshot(url);

  // 检查是否有验证码
  if (!skipCaptchaCheck) {
    const checkResult = await analyzeWithClaude(screenshotPath, '这张截图中是否有滑块验证、二维码登录或其他验证码？请回答"是"或"否"，并简要说明。');

    if (checkResult.includes('是') || checkResult.toLowerCase().includes('验证')) {
      console.log('⚠️  检测到验证码');

      // 交互式处理验证码
      await handleCaptchaInteractive();

      // 验证完成后重新截图
      console.log('📸 重新截图...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待页面刷新
      const newScreenshotPath = await captureScreenshot(url);

      // 继续使用新截图进行数据提取
      const extractPrompt = buildDouyinExtractPrompt(maxResults);
      const result = await analyzeWithClaude(newScreenshotPath, extractPrompt);

      return parseAndReturnData(result, keyword, url);
    }
  }

  // 构建提取Prompt
  const extractPrompt = buildDouyinExtractPrompt(maxResults);
  const result = await analyzeWithClaude(screenshotPath, extractPrompt);

  return parseAndReturnData(result, keyword, url);
}

/**
 * 构建抖音数据提取Prompt
 */
function buildDouyinExtractPrompt(maxResults) {
  return `这是抖音搜索结果页面的截图。请提取页面中所有可见的视频。

要求：
1. 提取最多${maxResults}条视频
2. 每条视频包含：标题、作者、播放量、点赞数（如果可见）
3. 以JSON数组格式输出

JSON格式：
[
  {
    "title": "视频标题",
    "author": "作者名",
    "views": "播放量",
    "likes": "点赞数"
  }
]`;
}

/**
 * 解析并返回数据
 */
function parseAndReturnData(result, keyword, url) {
  let jsonText = result.trim().replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  const data = JSON.parse(jsonText);

  console.log(`✅ 成功提取 ${data.length} 条视频`);
  return {
    keyword,
    url,
    timestamp: new Date().toISOString(),
    count: data.length,
    data
  };
}

/**
 * 保存数据到文件
 */
async function saveData(data, filename) {
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const filepath = path.join(CONFIG.outputDir, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));

  console.log(`\n💾 数据已保存: ${filepath}`);
  return filepath;
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 超级数据视觉抓取工具\n');

  // 检查browse
  const browseReady = await ensureBrowse();
  if (!browseReady) {
    console.error('请先启动browse: ~/.claude/skills/gstack/browse/dist/browse status');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'weibo':
        // node scraper-vision.js weibo "护肤品" --max=10
        const weiboKeyword = args[1];
        if (!weiboKeyword) throw new Error('请提供搜索关键词');

        const weiboOptions = {
          maxResults: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || 10
        };

        const weiboResult = await scrapeWeibo(weiboKeyword, weiboOptions);
        await saveData(weiboResult, `weibo_${weiboKeyword}_${Date.now()}.json`);
        break;

      case 'xiaohongshu':
      case 'xhs':
        // node scraper-vision.js xiaohongshu "护肤" --max=10 --proxy="http://proxy:port"
        const xhsKeyword = args[1];
        if (!xhsKeyword) throw new Error('请提供搜索关键词');

        const xhsOptions = {
          maxResults: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || 10,
          proxy: args.find(a => a.startsWith('--proxy='))?.split('=')[1]
        };

        const xhsResult = await scrapeXiaohongshu(xhsKeyword, xhsOptions);
        await saveData(xhsResult, `xiaohongshu_${xhsKeyword}_${Date.now()}.json`);
        break;

      case 'douyin':
        // node scraper-vision.js douyin "护肤教程" --max=10 --skip-captcha
        const douyinKeyword = args[1];
        if (!douyinKeyword) throw new Error('请提供搜索关键词');

        const douyinOptions = {
          maxResults: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || 10,
          skipCaptchaCheck: args.includes('--skip-captcha')
        };

        const douyinResult = await scrapeDouyin(douyinKeyword, douyinOptions);
        await saveData(douyinResult, `douyin_${douyinKeyword}_${Date.now()}.json`);
        break;

      default:
        console.log(`使用方法：

📝 微博搜索:
  node scraper-vision.js weibo "关键词" --max=10

📕 小红书搜索:
  node scraper-vision.js xiaohongshu "关键词" --max=10 --proxy="http://proxy:port"

🎵 抖音搜索:
  node scraper-vision.js douyin "关键词" --max=10

注意事项:
- 首次使用需要先导入Cookie: 使用 /setup-browser-cookies
- 小红书需要代理绕过IP风控
- 抖音可能触发滑块验证

数据保存在: ${CONFIG.outputDir}/
        `);
    }
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (error.message.includes('CAPTCHA_DETECTED')) {
      console.log('\n💡 建议: 使用 browse handoff 命令手动完成验证');
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('scraper-vision.js'));

if (isMainModule) {
  main();
}

export { scrapeWeibo, scrapeXiaohongshu, scrapeDouyin, captureScreenshot, analyzeWithClaude, saveData };
