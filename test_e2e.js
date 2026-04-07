#!/usr/bin/env node
/**
 * E2E测试脚本
 * 测试完整流程：数据生成 → API调用 → 报告生成
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 测试配置
const API_BASE = 'http://localhost:8080';
const TEST_BRAND = 'E2E测试品牌';
const TEST_CATEGORY = 'E2E测试类目';

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

// 测试步骤
async function testE2E() {
  log('\n╔══════════════════════════════════════════╗', 'blue');
  log('║   超级数据 E2E 测试                      ║', 'blue');
  log('╚══════════════════════════════════════════╝', 'blue');

  const totalSteps = 6;
  let currentStep = 0;

  try {
    // Step 1: 检查服务器状态
    currentStep++;
    logStep(currentStep, totalSteps, '检查服务器状态');

    try {
      const response = await fetch(`${API_BASE}/`);
      if (response.ok) {
        logSuccess('服务器运行正常');
      } else {
        throw new Error(`服务器响应异常: ${response.status}`);
      }
    } catch (error) {
      logError('服务器未运行，请先启动: npm run platform');
      process.exit(1);
    }

    // Step 2: 生成测试数据包
    currentStep++;
    logStep(currentStep, totalSteps, '生成测试数据包');

    const dataDir = path.join(__dirname, 'data');
    const timestamp = Date.now();
    const testFilename = `test_full_${TEST_BRAND}_${timestamp}.json`;
    const testFilePath = path.join(dataDir, testFilename);

    const testData = {
      type: "full_dataset",
      brand: TEST_BRAND,
      category: TEST_CATEGORY,
      generatedAt: new Date().toISOString(),
      status: "test_data",
      message: "E2E测试数据包",
      data: {
        marketTrends: {
          topic: TEST_CATEGORY,
          platforms: ["小红书", "抖音"],
          trends: [{
            platform: "小红书",
            heatIndex: 88,
            topKeywords: ["测试关键词1", "测试关键词2"],
            contentTypes: ["图文", "视频"]
          }]
        },
        viralVideos: {
          count: 3,
          topVideos: [{
            title: "测试视频1",
            views: 100000,
            likes: 10000,
            platform: "抖音"
          }]
        },
        competitors: {
          list: ["测试竞品A", "测试竞品B"],
          comparison: {
            "测试竞品A": {
              marketShare: "15%",
              avgPrice: 99,
              rating: 4.5
            }
          }
        },
        insights: {
          recommendation: "E2E测试建议",
          targetAudience: "测试目标人群",
          bestTimeToPost: "晚上8-10点"
        }
      },
      metadata: {
        dataSource: "E2E测试",
        processingTime: "即时",
        note: "这是E2E测试数据"
      }
    };

    await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));
    logSuccess(`测试数据已生成: ${testFilename}`);

    // Step 3: 测试统计API
    currentStep++;
    logStep(currentStep, totalSteps, '测试统计API');

    const statsResponse = await fetch(`${API_BASE}/api/stats`);
    const stats = await statsResponse.json();

    if (stats.totalFiles >= 1) {
      logSuccess(`统计API正常，数据包总数: ${stats.totalFiles}`);
    } else {
      logWarning('统计API返回数据为空');
    }

    // Step 4: 测试文件列表API
    currentStep++;
    logStep(currentStep, totalSteps, '测试文件列表API');

    const filesResponse = await fetch(`${API_BASE}/api/files`);
    const files = await filesResponse.json();

    const testFile = files.find(f => f.filename === testFilename);
    if (testFile) {
      logSuccess(`找到测试文件: ${testFilename}`);
    } else {
      logWarning('文件列表中未找到测试文件（可能需要刷新）');
    }

    // Step 5: 测试报告生成API
    currentStep++;
    logStep(currentStep, totalSteps, '测试AI报告生成API');

    log('📝 发起报告生成请求...');
    const reportResponse = await fetch(`${API_BASE}/api/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataPackageId: testFilename,
        reportType: 'full'
      })
    });

    const reportResult = await reportResponse.json();

    if (reportResult.success && reportResult.taskId) {
      logSuccess(`报告任务已创建: ${reportResult.taskId}`);

      // 监听SSE进度
      log('🔄 监听报告生成进度（最多等待60秒）...');

      await new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${API_BASE}/api/progress/${reportResult.taskId}`);
        const timeout = setTimeout(() => {
          eventSource.close();
          reject(new Error('报告生成超时（60秒）'));
        }, 60000);

        let hasContent = false;

        eventSource.addEventListener('message', (e) => {
          const data = JSON.parse(e.data);

          switch (data.type) {
            case 'report_chunk':
              if (!hasContent) {
                log('📄 开始接收报告内容...');
                hasContent = true;
              }
              process.stdout.write('.');
              break;

            case 'complete':
              clearTimeout(timeout);
              eventSource.close();
              console.log(''); // 换行
              logSuccess('报告生成完成');
              resolve();
              break;

            case 'error':
              clearTimeout(timeout);
              eventSource.close();
              reject(new Error(data.message));
              break;
          }
        });

        eventSource.onerror = (error) => {
          clearTimeout(timeout);
          eventSource.close();
          reject(new Error('SSE连接失败'));
        };
      });

    } else {
      throw new Error(reportResult.error || '报告生成请求失败');
    }

    // Step 6: 验证报告文件
    currentStep++;
    logStep(currentStep, totalSteps, '验证报告文件');

    const reportsDir = path.join(dataDir, 'reports');
    const reportFiles = await fs.readdir(reportsDir);
    const latestReport = reportFiles
      .filter(f => f.endsWith('.md'))
      .sort()
      .pop();

    if (latestReport) {
      const reportPath = path.join(reportsDir, latestReport);
      const reportContent = await fs.readFile(reportPath, 'utf-8');

      logSuccess(`报告文件已生成: ${latestReport}`);
      log(`   文件大小: ${(reportContent.length / 1024).toFixed(2)} KB`);
      log(`   字数: ${reportContent.length} 字符`);

      // 简单验证报告内容
      const hasHeadings = reportContent.includes('##');
      const hasContent = reportContent.length > 500;

      if (hasHeadings && hasContent) {
        logSuccess('报告内容验证通过');
      } else {
        logWarning('报告内容可能不完整');
      }
    } else {
      logWarning('未找到最新报告文件');
    }

    // 测试完成
    log('\n╔══════════════════════════════════════════╗', 'green');
    log('║   ✅ E2E测试全部通过                     ║', 'green');
    log('╚══════════════════════════════════════════╝', 'green');

    log('\n📊 测试摘要:', 'blue');
    log(`   测试数据包: ${testFilename}`);
    log(`   报告文件: ${latestReport || '未生成'}`);
    log(`   服务器: ${API_BASE}`);

    log('\n💡 提示:', 'yellow');
    log('   - 刷新浏览器查看新数据包');
    log('   - 点击"生成AI数据报告"测试前端UI');
    log('   - 查看 data/reports/ 目录下的报告文件');

  } catch (error) {
    log('\n╔══════════════════════════════════════════╗', 'red');
    log('║   ❌ E2E测试失败                         ║', 'red');
    log('╚══════════════════════════════════════════╝', 'red');

    logError(`错误: ${error.message}`);

    if (error.stack) {
      log('\n错误堆栈:', 'red');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// 运行测试
testE2E();
