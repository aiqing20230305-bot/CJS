#!/usr/bin/env node
/**
 * 最终测试 - 实际运行数据抓取功能
 */

import { fetchWebContent, searchAndFetch } from './scraper.js';
import fs from 'fs/promises';

console.log('🎯 最终功能测试\n');
console.log('这将使用 Gemini CLI 进行实际的数据抓取测试\n');

// 加载环境变量
try {
  const envContent = await fs.readFile('.env', 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      process.env[key.trim()] = value.trim();
    }
  }
  console.log('✅ 已加载 .env 环境变量\n');
} catch (error) {
  console.log('⚠️  .env 文件不存在，使用系统配置\n');
}

async function runTests() {
  console.log('=' .repeat(50));
  console.log('测试 1: 简单搜索（2 条结果）');
  console.log('=' .repeat(50));

  try {
    console.log('正在搜索"AI工具"...\n');
    const results = await searchAndFetch('AI工具', { maxResults: 2 });
    console.log('✅ 搜索成功！');
    console.log('结果预览:', results.substring(0, 200), '...\n');
  } catch (error) {
    console.error('❌ 搜索失败:', error.message, '\n');
  }

  console.log('=' .repeat(50));
  console.log('测试完成！');
  console.log('=' .repeat(50));
  console.log('\n💡 如果看到上面的结果，说明配置成功！');
  console.log('   可以开始使用完整的数据抓取功能了\n');
}

runTests().catch(error => {
  console.error('\n❌ 测试过程中出错:', error);
  console.error('\n💡 可能的原因:');
  console.error('   1. API Key 未正确配置');
  console.error('   2. 网络连接问题');
  console.error('   3. Gemini API 配额限制\n');
  console.error('   请运行 node quick_test.js 检查配置状态\n');
  process.exit(1);
});
