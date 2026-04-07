#!/usr/bin/env node
/**
 * 数据抓取能力E2E测试
 * 测试真实的Gemini API调用和数据抓取流程
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, total, msg) {
  log(`\n[${step}/${total}] ${msg}`, 'cyan');
}

function logSuccess(msg) {
  log(`✅ ${msg}`, 'green');
}

function logError(msg) {
  log(`❌ ${msg}`, 'red');
}

function logWarning(msg) {
  log(`⚠️  ${msg}`, 'yellow');
}

async function testScraperE2E() {
  log('\n╔══════════════════════════════════════════╗', 'blue');
  log('║   数据抓取能力 E2E 测试                  ║', 'blue');
  log('╚══════════════════════════════════════════╝', 'blue');

  const totalSteps = 7;
  let currentStep = 0;
  const results = {
    geminiCLI: null,
    basicFetch: null,
    searchFetch: null,
    trendAnalysis: null,
    superInsight: null,
    webScrape: null
  };

  try {
    // Step 1: 验证Gemini CLI配置
    currentStep++;
    logStep(currentStep, totalSteps, '验证Gemini CLI配置');

    try {
      const { stdout } = await execAsync('npx @google/gemini-cli --version');
      const version = stdout.trim();
      logSuccess(`Gemini CLI版本: ${version}`);
      results.geminiCLI = 'pass';
    } catch (error) {
      logError(`Gemini CLI未安装或配置错误: ${error.message}`);
      results.geminiCLI = 'fail';
    }

    // Step 2: 测试基础Gemini API调用
    currentStep++;
    logStep(currentStep, totalSteps, '测试Gemini API基础调用（10秒超时）');

    try {
      log('📡 调用Gemini API: "你好，请回复测试成功"');
      const { stdout, stderr } = await execAsync(
        'npx @google/gemini-cli -p "你好，请回复\\"测试成功\\""',
        { timeout: 10000 }
      );

      if (stdout.includes('测试成功')) {
        logSuccess('Gemini API调用成功，响应正确');
        results.basicFetch = 'pass';
      } else {
        logWarning(`API调用成功，但响应异常: ${stdout.substring(0, 100)}`);
        results.basicFetch = 'warning';
      }
    } catch (error) {
      if (error.killed) {
        logError('API调用超时（10秒）');
      } else {
        logError(`API调用失败: ${error.message}`);
      }
      results.basicFetch = 'fail';
    }

    // Step 3: 测试scraper.js搜索功能
    currentStep++;
    logStep(currentStep, totalSteps, '测试scraper.js搜索功能（35秒超时）');

    log('🔍 执行: node scraper.js search "AI工具" --max=1');
    try {
      const { stdout, stderr } = await execAsync(
        'node scraper.js search "AI工具" --max=1',
        { timeout: 35000 }
      );

      // 检查是否生成了数据文件
      const dataFiles = await fs.readdir('./data');
      const searchFiles = dataFiles.filter(f => f.startsWith('search_'));

      if (searchFiles.length > 0) {
        const latestSearch = searchFiles.sort().pop();
        logSuccess(`搜索完成，生成文件: ${latestSearch}`);

        // 读取文件内容验证
        const content = await fs.readFile(`./data/${latestSearch}`, 'utf-8');
        const data = JSON.parse(content);

        if (Array.isArray(data) && data.length > 0) {
          logSuccess(`数据验证通过，找到 ${data.length} 条结果`);
          results.searchFetch = 'pass';
        } else {
          logWarning('数据格式异常或为空');
          results.searchFetch = 'warning';
        }
      } else {
        logWarning('未找到生成的搜索文件');
        results.searchFetch = 'warning';
      }
    } catch (error) {
      if (error.killed) {
        logError('搜索超时（35秒）');
      } else {
        logError(`搜索失败: ${error.message}`);
      }
      results.searchFetch = 'fail';
    }

    // Step 4: 测试趋势分析功能
    currentStep++;
    logStep(currentStep, totalSteps, '测试scraper.js趋势分析（45秒超时）');

    log('📊 执行: node scraper.js trends "护肤品" --days=7');
    try {
      const { stdout } = await execAsync(
        'node scraper.js trends "护肤品" --days=7',
        { timeout: 45000 }
      );

      const dataFiles = await fs.readdir('./data');
      const trendFiles = dataFiles.filter(f => f.startsWith('trends_'));

      if (trendFiles.length > 0) {
        const latestTrend = trendFiles.sort().pop();
        logSuccess(`趋势分析完成，生成文件: ${latestTrend}`);

        // 验证数据结构
        const content = await fs.readFile(`./data/${latestTrend}`, 'utf-8');
        const data = JSON.parse(content);

        if (data.topic && data.trends) {
          logSuccess('趋势数据结构验证通过');
          results.trendAnalysis = 'pass';
        } else {
          logWarning('趋势数据结构不完整');
          results.trendAnalysis = 'warning';
        }
      } else {
        logWarning('未找到生成的趋势文件');
        results.trendAnalysis = 'warning';
      }
    } catch (error) {
      if (error.killed) {
        logError('趋势分析超时（45秒）');
      } else {
        logError(`趋势分析失败: ${error.message}`);
      }
      results.trendAnalysis = 'fail';
    }

    // Step 5: 测试super-insight.js完整采集（允许部分失败）
    currentStep++;
    logStep(currentStep, totalSteps, '测试super-insight完整采集（120秒超时）');

    log('🚀 执行: node integrations/super-insight.js full --brand="测试" --category="测试" --competitors="A,B"');
    log('💡 提示: 此步骤允许部分失败，只要有1个步骤成功即可');

    try {
      const { stdout, stderr } = await execAsync(
        'node integrations/super-insight.js full --brand="E2E测试" --category="测试类目" --competitors="A,B"',
        { timeout: 120000 }
      );

      // 检查是否生成了full_数据包
      const dataFiles = await fs.readdir('./data');
      const fullFiles = dataFiles.filter(f => f.startsWith('full_') && f.includes('E2E测试'));

      if (fullFiles.length > 0) {
        const latestFull = fullFiles.sort().pop();
        logSuccess(`完整数据包已生成: ${latestFull}`);

        // 验证数据结构
        const content = await fs.readFile(`./data/${latestFull}`, 'utf-8');
        const data = JSON.parse(content);

        const successfulSteps = Object.values(data.data || {}).filter(v => v !== null).length;
        const totalSteps = 4;

        log(`   成功率: ${successfulSteps}/${totalSteps} (${(successfulSteps / totalSteps * 100).toFixed(0)}%)`);

        if (successfulSteps >= 1) {
          logSuccess('至少1个采集步骤成功，测试通过');
          results.superInsight = 'pass';
        } else {
          logWarning('所有采集步骤均失败');
          results.superInsight = 'warning';
        }
      } else {
        logWarning('未找到完整数据包文件');
        results.superInsight = 'warning';
      }
    } catch (error) {
      if (error.killed) {
        logError('完整采集超时（120秒）');
      } else {
        logError(`完整采集失败: ${error.message}`);
      }
      results.superInsight = 'fail';
    }

    // Step 6: 测试Web界面抓取API
    currentStep++;
    logStep(currentStep, totalSteps, '测试Web界面抓取API（150秒超时）');

    log('🌐 调用: POST /api/scrape');
    try {
      const response = await fetch('http://localhost:8080/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'API测试',
          category: '测试',
          competitors: ['A', 'B'],
          scrapeType: 'full',
          platforms: ['小红书', '抖音'],
          days: 7,
          maxResults: 5
        })
      });

      const result = await response.json();

      if (result.success && result.taskId) {
        logSuccess(`抓取任务已创建: ${result.taskId}`);

        // 监听SSE进度（简化版，不等待完成）
        log('🔄 监听进度（前30秒）...');

        await new Promise((resolve) => {
          const eventSource = new EventSource(`http://localhost:8080/api/progress/${result.taskId}`);
          const timeout = setTimeout(() => {
            eventSource.close();
            resolve();
          }, 30000);

          let hasLog = false;

          eventSource.addEventListener('message', (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'log' && !hasLog) {
              log(`   收到进度日志: ${data.message.substring(0, 50)}...`);
              hasLog = true;
            }
            if (data.type === 'complete') {
              clearTimeout(timeout);
              eventSource.close();
              resolve();
            }
          });
        });

        logSuccess('Web抓取API响应正常（后台继续执行）');
        results.webScrape = 'pass';
      } else {
        logWarning(`API响应异常: ${result.error || '未知错误'}`);
        results.webScrape = 'warning';
      }
    } catch (error) {
      logError(`Web抓取API调用失败: ${error.message}`);
      results.webScrape = 'fail';
    }

    // Step 7: 生成测试报告
    currentStep++;
    logStep(currentStep, totalSteps, '生成测试报告');

    const passCount = Object.values(results).filter(r => r === 'pass').length;
    const warnCount = Object.values(results).filter(r => r === 'warning').length;
    const failCount = Object.values(results).filter(r => r === 'fail').length;
    const totalTests = Object.keys(results).length;

    log('\n╔══════════════════════════════════════════╗', 'blue');
    log('║   数据抓取能力测试报告                   ║', 'blue');
    log('╚══════════════════════════════════════════╝', 'blue');

    log('\n📊 测试结果:', 'blue');
    Object.entries(results).forEach(([test, status]) => {
      const icon = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
      const color = status === 'pass' ? 'green' : status === 'warning' ? 'yellow' : 'red';
      log(`   ${icon} ${test}: ${status}`, color);
    });

    log('\n📈 统计:', 'blue');
    log(`   通过: ${passCount}/${totalTests} (${(passCount / totalTests * 100).toFixed(0)}%)`, 'green');
    log(`   警告: ${warnCount}/${totalTests}`, 'yellow');
    log(`   失败: ${failCount}/${totalTests}`, 'red');

    // 判断整体结果
    if (passCount >= 4) {
      log('\n✅ 数据抓取能力测试通过！', 'green');
      log('💡 提示: 大部分功能正常，可以投入使用', 'green');
    } else if (passCount >= 2) {
      log('\n⚠️  数据抓取能力部分可用', 'yellow');
      log('💡 建议: 修复失败的测试项，或使用演示数据生成器', 'yellow');
    } else {
      log('\n❌ 数据抓取能力测试失败', 'red');
      log('💡 建议: 检查Gemini API配置，或优先使用演示数据生成器', 'red');
    }

    log('\n📁 可用的数据文件:', 'blue');
    const dataFiles = await fs.readdir('./data');
    const jsonFiles = dataFiles.filter(f => f.endsWith('.json')).slice(-5);
    jsonFiles.forEach(f => log(`   - ${f}`));

  } catch (error) {
    log('\n╔══════════════════════════════════════════╗', 'red');
    log('║   ❌ 测试执行失败                        ║', 'red');
    log('╚══════════════════════════════════════════╝', 'red');

    logError(`错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行测试
testScraperE2E();
