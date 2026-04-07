#!/usr/bin/env node
/**
 * 超级数据 - 数据抓取工具
 * 基于 Gemini CLI 的网页内容抓取和分析
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 配置
const CONFIG = {
  outputDir: './data',
  geminiCommand: 'npx @google/gemini-cli'
};

/**
 * 解析Gemini CLI的JSON输出
 * CLI输出格式: { "session_id": "...", "response": "实际内容", "stats": {...} }
 */
function parseGeminiCLIOutput(stdout) {
  try {
    const cliOutput = JSON.parse(stdout);
    // response字段本身是一个JSON字符串，需要再次解析
    return cliOutput.response || stdout;
  } catch (error) {
    // 如果解析失败，返回原始输出
    console.warn('⚠️  无法解析Gemini CLI输出，返回原始内容');
    return stdout;
  }
}

/**
 * 使用 Gemini CLI 抓取网页内容（带配额降级）
 */
async function fetchWebContent(url, query = '提取页面所有关键信息') {
  console.log(`\n📡 正在抓取: ${url}`);
  console.log(`⏱️  超时设置: 30秒`);

  const prompt = `请访问这个网址并${query}：${url}

要求：
1. 提取页面标题、主要内容、关键数据
2. 识别文章发布时间、作者等元信息
3. 提取所有图片链接
4. 以 JSON 格式输出结果

JSON 格式示例：
{
  "title": "页面标题",
  "url": "${url}",
  "publishDate": "发布时间",
  "author": "作者",
  "content": "主要内容摘要",
  "images": ["图片1", "图片2"],
  "keyPoints": ["要点1", "要点2"],
  "crawledAt": "${new Date().toISOString()}"
}`;

  try {
    console.log(`🔄 调用Gemini API...`);
    const { stdout, stderr } = await execAsync(
      `${CONFIG.geminiCommand} -p "${prompt.replace(/"/g, '\\"')}" --output-format json`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 30000 // 30秒超时
      }
    );

    if (stderr) {
      // 检查是否是配额错误
      if (stderr.includes('exhausted your daily quota') || stderr.includes('quota exceeded') || stderr.includes('429')) {
        console.warn('⚠️  Gemini API 配额已用完，请稍后重试或使用视觉抓取方案');
        throw new Error('QUOTA_EXCEEDED: Gemini API 每日配额已用完（免费版限制 20 次/天）。建议：1) 等待明天重置 2) 使用 /api/scrape-vision 视觉抓取 3) 升级到付费版');
      }
      console.warn('⚠️  警告:', stderr);
    }

    console.log(`✅ 抓取完成`);
    return parseGeminiCLIOutput(stdout);
  } catch (error) {
    // 配额错误特殊处理
    if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
      throw error;
    }

    // 检查错误输出中是否包含配额信息
    const errorOutput = error.stderr || error.stdout || error.message || '';
    if (errorOutput.includes('exhausted your daily quota') || errorOutput.includes('quota exceeded')) {
      console.error('❌ Gemini API 配额已用完');
      throw new Error('QUOTA_EXCEEDED: Gemini API 每日配额已用完（免费版限制 20 次/天）。建议使用视觉抓取方案：node platform-server.js 启动后访问 http://localhost:8080，选择"视觉抓取"模式');
    }

    if (error.killed && error.signal === 'SIGTERM') {
      console.error('❌ 抓取超时（30秒）');
    } else {
      console.error('❌ 抓取失败:', error.message);
    }
    throw error;
  }
}

/**
 * 搜索并抓取相关内容（带配额降级）
 */
async function searchAndFetch(keyword, options = {}) {
  const { maxResults = 5, platform = '全网' } = options;

  console.log(`\n🔍 搜索关键词: ${keyword} (${platform})`);
  console.log(`⏱️  超时设置: 30秒`);

  const prompt = `使用 Google Search 搜索关键词"${keyword}"，并提取前${maxResults}条结果。

要求：
1. 每条结果包含：标题、链接、摘要
2. 如果指定平台"${platform}"，优先展示该平台的结果
3. 以 JSON 数组格式输出

JSON 格式：
[
  {
    "title": "标题",
    "url": "链接",
    "snippet": "摘要",
    "platform": "平台名称"
  }
]`;

  try {
    console.log(`🔄 调用Gemini API...`);
    const { stdout, stderr } = await execAsync(
      `${CONFIG.geminiCommand} -p "${prompt.replace(/"/g, '\\"')}" --output-format json`,
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000 // 30秒超时
      }
    );

    // 检查配额错误
    if (stderr && (stderr.includes('exhausted your daily quota') || stderr.includes('quota exceeded'))) {
      throw new Error('QUOTA_EXCEEDED: Gemini API 配额已用完');
    }

    console.log(`✅ 搜索完成，找到数据`);
    return parseGeminiCLIOutput(stdout);
  } catch (error) {
    // 配额错误处理
    const errorOutput = error.stderr || error.stdout || error.message || '';
    if (errorOutput.includes('exhausted your daily quota') || errorOutput.includes('quota exceeded')) {
      console.error('❌ Gemini API 配额已用完（免费版 20 次/天）');
      throw new Error('QUOTA_EXCEEDED: 请使用视觉抓取方案或等待明天重置');
    }

    if (error.killed && error.signal === 'SIGTERM') {
      console.error('❌ 搜索超时（30秒）');
    } else {
      console.error('❌ 搜索失败:', error.message);
    }
    throw error;
  }
}

/**
 * 分析内容趋势（带配额降级）
 */
async function analyzeTrends(topic, options = {}) {
  const { platforms = ['小红书', '抖音', '微博'], days = 7 } = options;

  console.log(`\n📊 分析趋势: ${topic}`);
  console.log(`⏱️  超时设置: 40秒`);

  const prompt = `分析"${topic}"在 ${platforms.join('、')} 等平台近${days}天的内容趋势。

要求：
1. 热度变化趋势
2. 热门内容类型（图文、视频、直播等）
3. 用户关注点
4. 爆款内容特征
5. 数据来源标注

以结构化 JSON 输出：
{
  "topic": "${topic}",
  "period": "${days}天",
  "platforms": ${JSON.stringify(platforms)},
  "trends": [
    {
      "platform": "平台名",
      "heatIndex": 85,
      "contentTypes": ["类型1", "类型2"],
      "topKeywords": ["关键词1", "关键词2"],
      "viralPatterns": ["特征1", "特征2"]
    }
  ],
  "summary": "整体趋势总结",
  "analyzedAt": "${new Date().toISOString()}"
}`;

  try {
    console.log(`🔄 调用Gemini API...`);
    const { stdout, stderr } = await execAsync(
      `${CONFIG.geminiCommand} -p "${prompt.replace(/"/g, '\\"')}" --output-format json`,
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 40000 // 40秒超时（趋势分析较复杂）
      }
    );

    // 检查配额错误
    if (stderr && (stderr.includes('exhausted your daily quota') || stderr.includes('quota exceeded'))) {
      throw new Error('QUOTA_EXCEEDED: Gemini API 配额已用完');
    }

    console.log(`✅ 分析完成`);
    return parseGeminiCLIOutput(stdout);
  } catch (error) {
    // 配额错误处理
    const errorOutput = error.stderr || error.stdout || error.message || '';
    if (errorOutput.includes('exhausted your daily quota') || errorOutput.includes('quota exceeded')) {
      console.error('❌ Gemini API 配额已用完（免费版 20 次/天）');
      throw new Error('QUOTA_EXCEEDED: 请使用视觉抓取方案或等待明天重置');
    }

    if (error.killed && error.signal === 'SIGTERM') {
      console.error('❌ 分析超时（40秒）');
    } else {
      console.error('❌ 分析失败:', error.message);
    }
    throw error;
  }
}

/**
 * 保存数据到文件
 */
async function saveData(data, filename) {
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  const filepath = path.join(CONFIG.outputDir, filename);
  await fs.writeFile(filepath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));

  console.log(`\n💾 数据已保存: ${filepath}`);
  return filepath;
}

/**
 * 批量抓取 URL 列表
 */
async function batchFetch(urls, query) {
  console.log(`\n📦 批量抓取 ${urls.length} 个链接`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    console.log(`\n进度: ${i + 1}/${urls.length}`);
    try {
      const data = await fetchWebContent(urls[i], query);
      results.push(data);

      // 避免请求过快
      if (i < urls.length - 1) {
        console.log('⏳ 等待 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      results.push({ error: error.message, url: urls[i] });
    }
  }

  return results;
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 超级数据抓取工具\n');

  try {
    switch (command) {
      case 'fetch':
        // 单个 URL 抓取
        // node scraper.js fetch "https://example.com"
        const url = args[1];
        if (!url) throw new Error('请提供 URL');

        const content = await fetchWebContent(url);
        await saveData(content, `fetch_${Date.now()}.json`);
        break;

      case 'search':
        // 搜索关键词
        // node scraper.js search "关键词" --platform="小红书" --max=5
        const keyword = args[1];
        if (!keyword) throw new Error('请提供搜索关键词');

        const searchOptions = {
          platform: args.find(a => a.startsWith('--platform='))?.split('=')[1] || '全网',
          maxResults: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || 5
        };

        const searchResults = await searchAndFetch(keyword, searchOptions);
        await saveData(searchResults, `search_${keyword}_${Date.now()}.json`);
        break;

      case 'trends':
        // 趋势分析
        // node scraper.js trends "话题" --days=7
        const topic = args[1];
        if (!topic) throw new Error('请提供分析话题');

        const trendOptions = {
          days: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1]) || 7,
          platforms: args.find(a => a.startsWith('--platforms='))?.split('=')[1]?.split(',') || ['小红书', '抖音', '微博']
        };

        const trends = await analyzeTrends(topic, trendOptions);
        await saveData(trends, `trends_${topic}_${Date.now()}.json`);
        break;

      case 'batch':
        // 批量抓取（从文件读取 URL 列表）
        // node scraper.js batch urls.txt
        const urlsFile = args[1];
        if (!urlsFile) throw new Error('请提供 URL 列表文件');

        const urlsContent = await fs.readFile(urlsFile, 'utf-8');
        const urlsList = urlsContent.split('\n').filter(line => line.trim());

        const batchResults = await batchFetch(urlsList);
        await saveData(batchResults, `batch_${Date.now()}.json`);
        break;

      default:
        console.log(`使用方法：

📥 单页面抓取:
  node scraper.js fetch "https://example.com"

🔍 搜索抓取:
  node scraper.js search "关键词" --platform="小红书" --max=5

📊 趋势分析:
  node scraper.js trends "话题" --days=7 --platforms="小红书,抖音"

📦 批量抓取:
  node scraper.js batch urls.txt

数据保存在: ${CONFIG.outputDir}/
        `);
    }
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本（修复路径判断）
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('scraper.js'));

if (isMainModule) {
  main();
}

export { fetchWebContent, searchAndFetch, analyzeTrends, batchFetch, saveData };
