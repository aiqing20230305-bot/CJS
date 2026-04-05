#!/usr/bin/env node
/**
 * 快速测试 - 验证 Gemini CLI 配置
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

console.log('🧪 快速测试 Gemini CLI 配置\n');

// 1. 检查环境变量
console.log('1️⃣ 检查环境变量...');
const hasEnvKey = !!process.env.GEMINI_API_KEY;
console.log(`   GEMINI_API_KEY: ${hasEnvKey ? '✅ 已设置' : '❌ 未设置'}`);

// 2. 检查配置文件
console.log('\n2️⃣ 检查配置文件...');
try {
  const settingsPath = `${process.env.HOME}/.gemini/settings.json`;
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
  const hasFileKey = !!settings.apiKey;
  console.log(`   ~/.gemini/settings.json: ${hasFileKey ? '✅ 已配置' : '❌ 未配置'}`);
  if (hasFileKey) {
    console.log(`   API Key: ${settings.apiKey.substring(0, 15)}...`);
  }
} catch (error) {
  console.log('   ~/.gemini/settings.json: ❌ 文件不存在');
}

// 3. 检查本地 .env
console.log('\n3️⃣ 检查本地 .env...');
try {
  const envContent = await fs.readFile('.env', 'utf-8');
  const hasLocalKey = envContent.includes('GEMINI_API_KEY');
  console.log(`   .env 文件: ${hasLocalKey ? '✅ 存在' : '❌ 未配置'}`);
} catch (error) {
  console.log('   .env 文件: ❌ 不存在');
}

// 4. 测试 Gemini CLI 版本
console.log('\n4️⃣ 测试 Gemini CLI...');
try {
  const { stdout } = await execAsync('npx @google/gemini-cli --version');
  console.log(`   ✅ 版本: ${stdout.trim()}`);
} catch (error) {
  console.log('   ❌ 无法运行');
}

// 5. 尝试简单查询（仅显示命令）
console.log('\n5️⃣ 测试命令（示例）:');
console.log('   export GEMINI_API_KEY="your-key"');
console.log('   npx @google/gemini-cli -p "hello" --output-format text\n');

// 6. 提供使用建议
console.log('📝 使用建议:\n');
console.log('方法 1: 使用配置文件（推荐）');
console.log('  npx @google/gemini-cli  # 首次运行，按提示配置\n');

console.log('方法 2: 使用环境变量');
console.log('  export GEMINI_API_KEY="your-key"');
console.log('  node scraper.js search "关键词" --max=3\n');

console.log('方法 3: 使用便捷脚本');
console.log('  ./run.sh scraper.js search "关键词" --max=3\n');

console.log('✅ 配置检查完成！\n');
