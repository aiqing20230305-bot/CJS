#!/usr/bin/env node
/**
 * 验证码处理助手
 * 用于处理抖音等平台的滑块验证
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

const browseCommand = process.env.HOME + '/.claude/skills/gstack/browse/dist/browse';

/**
 * 交互式处理验证码
 */
async function handleCaptchaInteractive(platform, url) {
  console.log(`\n🔐 ${platform}检测到验证码`);
  console.log(`📱 正在打开浏览器，请手动完成验证...`);

  // 打开真实浏览器
  await execAsync(`${browseCommand} handoff "请完成${platform}验证"`);

  // 等待用户确认
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n✅ 验证完成后按回车继续...', () => {
      rl.close();
      resolve(true);
    });
  });
}

/**
 * 使用ddddocr自动识别（实验性）
 */
async function solveCaptchaAuto(backgroundPath, sliderPath) {
  try {
    console.log('🤖 正在尝试自动识别验证码...');

    const { stdout } = await execAsync(
      `python3 captcha_solver.py "${backgroundPath}" "${sliderPath}"`
    );

    const result = JSON.parse(stdout);

    if (result.success) {
      console.log(`✅ 识别成功：距离 ${result.distance}px`);
      return result.distance;
    } else {
      console.error(`❌ 识别失败：${result.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ 自动识别出错:', error.message);
    return null;
  }
}

export { handleCaptchaInteractive, solveCaptchaAuto };

// CLI模式
if (import.meta.url === `file://${process.argv[1]}`) {
  const platform = process.argv[2] || '抖音';
  const url = process.argv[3] || 'https://www.douyin.com/';

  handleCaptchaInteractive(platform, url).then(() => {
    console.log('✅ 验证流程完成');
    process.exit(0);
  });
}
