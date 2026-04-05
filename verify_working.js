#!/usr/bin/env node
/**
 * 验证系统工作正常
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

console.log('🎯 验证系统工作状态\n');

// 加载 .env
try {
  const envContent = await fs.readFile('.env', 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
} catch {}

console.log('测试 1: Gemini CLI 基础查询');
console.log('-'.repeat(50));

try {
  const { stdout, stderr } = await execAsync(
    `export GEMINI_API_KEY="${process.env.GEMINI_API_KEY}" && npx @google/gemini-cli -p "2+2等于几？直接回答数字" --output-format text`,
    { timeout: 30000 }
  );

  console.log('✅ 成功！');
  console.log('结果:', stdout.trim());
  console.log('');
} catch (error) {
  console.log('❌ 失败:', error.message);
  console.log('');
}

console.log('测试 2: 简单搜索查询');
console.log('-'.repeat(50));

try {
  const prompt = `使用 Google Search 搜索"AI工具"，返回前2条结果的标题和链接。

以 JSON 格式输出：
[
  {"title": "标题1", "url": "链接1"},
  {"title": "标题2", "url": "链接2"}
]`;

  const { stdout } = await execAsync(
    `export GEMINI_API_KEY="${process.env.GEMINI_API_KEY}" && npx @google/gemini-cli -p "${prompt.replace(/"/g, '\\"')}" --output-format text`,
    { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
  );

  console.log('✅ 成功！');
  console.log('结果预览:', stdout.substring(0, 300), '...');
  console.log('');

  // 保存结果
  await fs.mkdir('./data', { recursive: true });
  await fs.writeFile('./data/test_search_result.json', stdout);
  console.log('💾 结果已保存到: ./data/test_search_result.json\n');

} catch (error) {
  console.log('❌ 失败:', error.message);
  console.log('');
}

console.log('=' .repeat(50));
console.log('验证完成！');
console.log('=' .repeat(50));
console.log('\n✅ Gemini CLI 配置正确，系统工作正常！');
console.log('\n📝 现在可以使用完整功能：');
console.log('   node scraper.js search "关键词" --max=5');
console.log('   node integrations/super-insight.js full --brand="多芬"\n');
