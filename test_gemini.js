#!/usr/bin/env node
/**
 * 测试Gemini API配置
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

async function testGemini() {
  console.log('🔍 测试Gemini CLI配置...\n');

  // 1. 检查API Key
  console.log('1️⃣ 检查环境变量:');
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);

  // 2. 检查Gemini CLI版本
  console.log('\n2️⃣ 检查Gemini CLI版本:');
  try {
    const { stdout } = await execAsync('npx @google/gemini-cli --version');
    console.log(`   版本: ${stdout.trim()}`);
  } catch (error) {
    console.log(`   ❌ 无法获取版本: ${error.message}`);
  }

  // 3. 测试简单调用
  console.log('\n3️⃣ 测试简单调用:');
  try {
    const prompt = '你好，请回复"测试成功"';
    const command = `npx @google/gemini-cli -p "${prompt}"`;

    console.log(`   执行命令: ${command}`);
    console.log('   等待响应...');

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY },
      timeout: 30000 // 30秒超时
    });

    console.log(`   响应: ${stdout.trim()}`);
    if (stderr) {
      console.log(`   stderr: ${stderr}`);
    }

  } catch (error) {
    console.log(`   ❌ 调用失败:`);
    console.log(`   错误: ${error.message}`);
    if (error.stdout) console.log(`   stdout: ${error.stdout}`);
    if (error.stderr) console.log(`   stderr: ${error.stderr}`);
  }

  console.log('\n✅ 测试完成');
}

testGemini().catch(console.error);
