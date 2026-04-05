#!/usr/bin/env node
/**
 * 平台功能自动化测试
 * 测试SSE进度推送、文件API、批量下载等功能
 */

import http from 'http';
import { EventEmitter } from 'events';

const BASE_URL = 'http://localhost:8080';
const TIMEOUT = 10000;

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Test results
let passed = 0;
let failed = 0;
const results = [];

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function assert(condition, testName) {
  if (condition) {
    passed++;
    log(`✓ ${testName}`, colors.green);
    results.push({ name: testName, status: 'passed' });
  } else {
    failed++;
    log(`✗ ${testName}`, colors.red);
    results.push({ name: testName, status: 'failed' });
  }
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: TIMEOUT
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Test 1: 首页加载测试
async function testHomePage() {
  log('\n测试 1: 首页加载', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '首页返回 200 状态码');
    assert(res.body.includes('数据抓取配置平台'), '首页包含标题');
    assert(res.body.includes('loadDataPackages'), '首页包含JS代码');
  } catch (error) {
    assert(false, `首页加载失败: ${error.message}`);
  }
}

// Test 2: 文件列表API测试
async function testFilesAPI() {
  log('\n测试 2: 文件列表 API', colors.blue);
  try {
    const res = await makeRequest('/api/files');
    assert(res.statusCode === 200, 'API 返回 200 状态码');
    assert(res.headers['content-type'].includes('application/json'), '返回 JSON 格式');

    const files = JSON.parse(res.body);
    assert(Array.isArray(files), '返回数组格式');
    log(`  发现 ${files.length} 个文件`);

    if (files.length > 0) {
      const file = files[0];
      assert(file.filename, '文件包含 filename 字段');
      assert(file.time, '文件包含 time 字段');
      assert(file.size, '文件包含 size 字段');
    }
  } catch (error) {
    assert(false, `文件列表 API 失败: ${error.message}`);
  }
}

// Test 3: 单文件下载测试
async function testSingleDownload() {
  log('\n测试 3: 单文件下载', colors.blue);
  try {
    // First get file list
    const listRes = await makeRequest('/api/files');
    const files = JSON.parse(listRes.body);

    if (files.length === 0) {
      log('  ⚠️  跳过：没有可下载的文件', colors.yellow);
      return;
    }

    const testFile = files[0].filename;
    log(`  下载文件: ${testFile}`);

    const downloadRes = await makeRequest(`/api/download/${encodeURIComponent(testFile)}`);
    assert(downloadRes.statusCode === 200, '下载返回 200 状态码');
    assert(downloadRes.headers['content-disposition'], '包含 Content-Disposition 头');
    assert(downloadRes.body.length > 0, '文件内容不为空');

    // Verify it's valid JSON
    try {
      JSON.parse(downloadRes.body);
      assert(true, '下载的文件是有效的 JSON');
    } catch {
      assert(false, '下载的文件不是有效的 JSON');
    }
  } catch (error) {
    assert(false, `单文件下载失败: ${error.message}`);
  }
}

// Test 4: 批量下载测试
async function testBatchDownload() {
  log('\n测试 4: 批量下载 (ZIP)', colors.blue);
  try {
    const res = await makeRequest('/api/download-all');

    if (res.statusCode === 404) {
      log('  ⚠️  跳过：没有可下载的文件', colors.yellow);
      return;
    }

    assert(res.statusCode === 200, '批量下载返回 200 状态码');
    assert(res.headers['content-type'].includes('application/zip'), '返回 ZIP 格式');
    assert(res.headers['content-disposition'], '包含 Content-Disposition 头');
    assert(res.body.length > 100, 'ZIP 文件大小合理');

    // Check ZIP magic number
    const isZip = res.body.startsWith('PK');
    assert(isZip, '返回的是有效的 ZIP 文件');
  } catch (error) {
    assert(false, `批量下载失败: ${error.message}`);
  }
}

// Test 5: SSE连接测试
async function testSSEConnection() {
  log('\n测试 5: SSE 实时进度推送', colors.blue);
  try {
    const taskId = Date.now().toString();
    const url = new URL(`/api/progress/${taskId}`, BASE_URL);

    const eventEmitter = new EventEmitter();
    let receivedConnection = false;
    let receivedError = false;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    }, (res) => {
      assert(res.statusCode === 200, 'SSE 连接返回 200');
      assert(res.headers['content-type'] === 'text/event-stream', '返回 text/event-stream');

      res.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.includes('"type":"connected"')) {
          receivedConnection = true;
          eventEmitter.emit('connected');
        }
        if (data.includes('"type":"error"')) {
          receivedError = true;
          eventEmitter.emit('error');
        }
      });
    });

    req.on('error', (err) => {
      assert(false, `SSE 连接失败: ${err.message}`);
      eventEmitter.emit('done');
    });

    req.end();

    // Wait for connection or error message
    await Promise.race([
      new Promise(resolve => eventEmitter.once('connected', resolve)),
      new Promise(resolve => eventEmitter.once('error', resolve)),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    req.destroy();

    assert(receivedConnection || receivedError, '收到 SSE 消息（connected 或 error）');
    log(`  连接状态: ${receivedConnection ? '已连接' : '未找到任务'}`);
  } catch (error) {
    assert(false, `SSE 测试失败: ${error.message}`);
  }
}

// Test 6: 统计API测试
async function testStatsAPI() {
  log('\n测试 6: 统计 API', colors.blue);
  try {
    const res = await makeRequest('/api/stats');
    assert(res.statusCode === 200, '统计 API 返回 200 状态码');
    assert(res.headers['content-type'].includes('application/json'), '返回 JSON 格式');
    assert(res.body.length > 0, '统计内容不为空');

    const stats = JSON.parse(res.body);
    assert(typeof stats.totalFiles === 'number', '包含 totalFiles 字段（数字）');
    assert(typeof stats.totalSize === 'number', '包含 totalSize 字段（数字）');
    assert(typeof stats.totalSizeFormatted === 'string', '包含 totalSizeFormatted 字段（字符串）');
    assert(typeof stats.avgFileSize === 'string', '包含 avgFileSize 字段（字符串）');
    assert(typeof stats.typeDistribution === 'object', '包含 typeDistribution 字段（对象）');
    assert(typeof stats.generatedAt === 'string', '包含 generatedAt 字段（字符串）');

    log(`  总文件数: ${stats.totalFiles}`);
    log(`  总大小: ${stats.totalSizeFormatted}`);
    log(`  平均大小: ${stats.avgFileSize}`);

    if (stats.latestFile) {
      assert(typeof stats.latestFile.filename === 'string', '最新文件包含 filename');
      assert(typeof stats.latestFile.time === 'string', '最新文件包含 time');
      log(`  最新文件: ${stats.latestFile.filename}`);
    }
  } catch (error) {
    assert(false, `统计 API 测试失败: ${error.message}`);
  }
}

// Test 7: 预览API测试
async function testPreviewAPI() {
  log('\n测试 6: 预览 API', colors.blue);
  try {
    // First get file list
    const listRes = await makeRequest('/api/files');
    const files = JSON.parse(listRes.body);

    if (files.length === 0) {
      log('  ⚠️  跳过：没有可预览的文件', colors.yellow);
      return;
    }

    const testFile = files[0].filename;
    log(`  预览文件: ${testFile}`);

    const previewRes = await makeRequest(`/api/preview/${encodeURIComponent(testFile)}`);
    assert(previewRes.statusCode === 200, '预览返回 200 状态码');
    assert(previewRes.headers['content-type'].includes('application/json'), '返回 JSON 格式');
    assert(previewRes.body.length > 0, '预览内容不为空');

    // Verify it's valid JSON
    try {
      const jsonData = JSON.parse(previewRes.body);
      assert(true, '返回的是有效的 JSON');
      assert(typeof jsonData === 'object', 'JSON 是对象类型');
    } catch {
      assert(false, '返回的不是有效的 JSON');
    }
  } catch (error) {
    assert(false, `预览 API 测试失败: ${error.message}`);
  }
}

// Test 8: 抓取API测试（不实际执行）
async function testScrapeAPI() {
  log('\n测试 6: 抓取 API 接口验证', colors.blue);
  try {
    const testConfig = {
      brand: '测试品牌',
      category: '测试品类',
      competitors: ['竞品A'],
      scrapeType: 'market',
      days: 7,
      maxResults: 5,
      platforms: ['小红书']
    };

    const res = await makeRequest('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    });

    assert(res.statusCode === 200, '抓取 API 返回 200');

    const result = JSON.parse(res.body);
    assert(result.success, 'API 返回 success: true');
    assert(result.taskId, '返回任务 ID');

    log(`  任务 ID: ${result.taskId}`);
    log('  ⚠️  注意：任务可能因缺少 API Key 而失败，但接口本身可用', colors.yellow);
  } catch (error) {
    assert(false, `抓取 API 测试失败: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  log('╔══════════════════════════════════════════╗', colors.blue);
  log('║     数据抓取平台 - 功能测试套件          ║', colors.blue);
  log('╚══════════════════════════════════════════╝', colors.blue);

  await testHomePage();
  await testFilesAPI();
  await testSingleDownload();
  await testBatchDownload();
  await testSSEConnection();
  await testStatsAPI();
  await testPreviewAPI();
  await testScrapeAPI();

  // Summary
  log('\n╔══════════════════════════════════════════╗', colors.blue);
  log('║              测试结果汇总                 ║', colors.blue);
  log('╚══════════════════════════════════════════╝', colors.blue);

  log(`\n✓ 通过: ${passed}`, colors.green);
  log(`✗ 失败: ${failed}`, colors.red);
  log(`总计: ${passed + failed}\n`);

  if (failed === 0) {
    log('🎉 所有测试通过！', colors.green);
    process.exit(0);
  } else {
    log('⚠️  部分测试失败', colors.yellow);
    process.exit(1);
  }
}

// Start tests
runTests().catch(err => {
  log(`\n❌ 测试运行失败: ${err.message}`, colors.red);
  process.exit(1);
});
