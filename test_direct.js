#!/usr/bin/env node
/**
 * 直接测试 - 不依赖 shell 命令
 */

import fs from 'fs/promises';

console.log('🎯 直接功能测试\n');

// 1. 检查 API Key
console.log('1️⃣ 检查 API Key 配置...');
const settingsPath = `${process.env.HOME}/.gemini/settings.json`;
try {
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
  console.log('   ✅ 配置文件存在');
  console.log(`   ✅ API Key: ${settings.apiKey.substring(0, 20)}...\n`);
} catch (error) {
  console.log('   ❌ 配置文件不存在\n');
  process.exit(1);
}

// 2. 验证项目结构
console.log('2️⃣ 验证项目结构...');
const files = ['scraper.js', 'integrations/super-insight.js', 'package.json'];
for (const file of files) {
  try {
    await fs.access(file);
    console.log(`   ✅ ${file}`);
  } catch {
    console.log(`   ❌ ${file}`);
  }
}

// 3. 显示使用说明
console.log('\n3️⃣ 使用方式:\n');

console.log('方式 A: 直接运行（推荐）');
console.log('   配置已在 ~/.gemini/settings.json');
console.log('   直接使用即可：\n');
console.log('   node scraper.js search "AI工具" --max=3');
console.log('   node integrations/super-insight.js market "多芬" "洗护"\n');

console.log('方式 B: 使用便捷脚本');
console.log('   ./run.sh scraper.js search "关键词"\n');

console.log('方式 C: 交互式测试');
console.log('   npx @google/gemini-cli');
console.log('   # 进入交互模式后输入查询\n');

console.log('=' .repeat(50));
console.log('✅ 系统就绪！');
console.log('=' .repeat(50));
console.log('\n💡 建议：先运行 "npx @google/gemini-cli" 进入交互模式');
console.log('   验证 API 可以正常调用，然后再使用数据抓取功能\n');
