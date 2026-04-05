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
    const body = options.body || '';
    const headers = options.headers || {};

    // Add Content-Length header for requests with body
    if (body && options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers,
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

    if (body) {
      req.write(body);
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

// Test 7: Excel导出测试
async function testExcelExport() {
  log('\n测试 7: Excel 导出', colors.blue);
  try {
    // First get file list
    const listRes = await makeRequest('/api/files');
    const files = JSON.parse(listRes.body);

    if (files.length === 0) {
      log('  ⚠️  跳过：没有可导出的文件', colors.yellow);
      return;
    }

    const testFile = files[0].filename;
    log(`  导出文件: ${testFile}`);

    const exportRes = await makeRequest(`/api/export/${encodeURIComponent(testFile)}`);
    assert(exportRes.statusCode === 200, 'Excel导出返回 200 状态码');
    assert(exportRes.headers['content-type'].includes('spreadsheetml'), '返回 Excel 格式');
    assert(exportRes.headers['content-disposition'], '包含 Content-Disposition 头');
    assert(exportRes.body.length > 0, 'Excel 文件内容不为空');

    // Check Excel magic number (PK zip signature)
    const isExcel = exportRes.body.startsWith('PK');
    assert(isExcel, '返回的是有效的 Excel 文件（ZIP格式）');

    log(`  Excel 文件大小: ${(exportRes.body.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    assert(false, `Excel 导出测试失败: ${error.message}`);
  }
}

// Test 8: 批量Excel导出测试
async function testBatchExcelExport() {
  log('\n测试 8: 批量 Excel 导出', colors.blue);
  try {
    const res = await makeRequest('/api/export-all');

    if (res.statusCode === 404) {
      log('  ⚠️  跳过：没有可导出的文件', colors.yellow);
      return;
    }

    assert(res.statusCode === 200, '批量Excel导出返回 200 状态码');
    assert(res.headers['content-type'].includes('spreadsheetml'), '返回 Excel 格式');
    assert(res.headers['content-disposition'], '包含 Content-Disposition 头');
    assert(res.body.length > 0, 'Excel 文件内容不为空');

    // Check Excel magic number (PK zip signature)
    const isExcel = res.body.startsWith('PK');
    assert(isExcel, '返回的是有效的 Excel 文件（ZIP格式）');

    log(`  Excel 文件大小: ${(res.body.length / 1024).toFixed(2)} KB`);

    // Check filename pattern
    const filenameMatch = res.headers['content-disposition'].match(/filename\*=UTF-8''(.+)/);
    if (filenameMatch) {
      const filename = decodeURIComponent(filenameMatch[1]);
      assert(filename.includes('数据汇总'), '文件名包含"数据汇总"');
      assert(filename.endsWith('.xlsx'), '文件名以.xlsx结尾');
      log(`  文件名: ${filename}`);
    }
  } catch (error) {
    assert(false, `批量Excel导出测试失败: ${error.message}`);
  }
}

// Test 9: 预览API测试
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

// Test 10: 抓取API测试（不实际执行）
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

// Test 11: 搜索筛选UI元素测试
async function testSearchFilterUI() {
  log('\n测试 11: 搜索筛选 UI 元素', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check search input
    assert(html.includes('id="searchInput"'), '搜索框存在');
    assert(html.includes('placeholder="搜索文件名、品牌、关键词..."'), '搜索框提示文字正确');

    // Check type filter
    assert(html.includes('id="typeFilter"'), '类型筛选器存在');
    assert(html.includes('<option value="market">市场热点</option>'), '市场热点选项存在');
    assert(html.includes('<option value="video">爆款视频</option>'), '爆款视频选项存在');
    assert(html.includes('<option value="competitor">竞品分析</option>'), '竞品分析选项存在');

    // Check time filter
    assert(html.includes('id="timeFilter"'), '时间筛选器存在');
    assert(html.includes('<option value="today">今天</option>'), '今天选项存在');
    assert(html.includes('<option value="week">最近7天</option>'), '最近7天选项存在');
    assert(html.includes('<option value="month">最近30天</option>'), '最近30天选项存在');

    // Check sort buttons
    assert(html.includes('id="sortTime"'), '时间排序按钮存在');
    assert(html.includes('id="sortName"'), '名称排序按钮存在');
    assert(html.includes('id="sortSize"'), '大小排序按钮存在');

    // Check functions
    assert(html.includes('function handleSearch()'), 'handleSearch 函数存在');
    assert(html.includes('function applyFilters()'), 'applyFilters 函数存在');
    assert(html.includes('function handleSort('), 'handleSort 函数存在');
    assert(html.includes('function renderFileTable('), 'renderFileTable 函数存在');

    // Check CSS classes
    assert(html.includes('.search-filter-container'), '搜索筛选容器样式存在');
    assert(html.includes('.search-box'), '搜索框样式存在');
    assert(html.includes('.filter-select'), '筛选器样式存在');
    assert(html.includes('.sort-btn'), '排序按钮样式存在');

    log('  ✓ 所有搜索筛选UI元素验证通过');
  } catch (error) {
    assert(false, `搜索筛选UI测试失败: ${error.message}`);
  }
}

// Test 12: 文件删除API测试
async function testDeleteAPI() {
  log('\n测试 12: 文件删除 API', colors.blue);
  try {
    // Create a temporary test file
    const testFilename = `test_delete_${Date.now()}.json`;
    const testData = { test: 'data', timestamp: Date.now() };

    const fs = await import('fs');
    const path = await import('path');
    const testFilePath = path.join(process.cwd(), 'data', testFilename);

    // Write test file
    await fs.promises.writeFile(testFilePath, JSON.stringify(testData));
    log(`  创建测试文件: ${testFilename}`);

    // Test DELETE API
    const res = await makeRequest('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [testFilename] })
    });

    assert(res.statusCode === 200, '删除API返回 200 状态码');

    const result = JSON.parse(res.body);
    assert(result.success === true, 'API返回 success: true');
    assert(result.deleted === 1, '成功删除1个文件');
    assert(result.failed === 0, '失败数为0');

    // Verify file is deleted
    const fileExists = await fs.promises.access(testFilePath).then(() => true).catch(() => false);
    assert(!fileExists, '文件已被删除');

    log('  ✓ 文件删除成功');

    // Test security: path traversal
    const securityRes = await makeRequest('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: ['../test.json'] })
    });

    const securityResult = JSON.parse(securityRes.body);
    assert(securityResult.failed === 1, '路径遍历攻击被阻止');

    // Test empty array
    const emptyRes = await makeRequest('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [] })
    });

    assert(emptyRes.statusCode === 400, '空文件列表返回400错误');

    log('  ✓ 安全性验证通过');
  } catch (error) {
    assert(false, `文件删除API测试失败: ${error.message}`);
  }
}

// Test 14: 筛选条件持久化UI测试
async function testFilterPersistenceUI() {
  log('\n测试 14: 筛选条件持久化 UI', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check localStorage functions
    assert(html.includes('function getFilterState('), 'getFilterState 函数存在');
    assert(html.includes('function saveFilterState('), 'saveFilterState 函数存在');
    assert(html.includes('function loadFilterState('), 'loadFilterState 函数存在');
    assert(html.includes('function clearFilterState('), 'clearFilterState 函数存在');
    assert(html.includes('function applyFilterState('), 'applyFilterState 函数存在');

    // Check constants
    assert(html.includes('FILTER_STATE_KEY'), 'FILTER_STATE_KEY 常量存在');
    assert(html.includes('isLoadingState'), 'isLoadingState 标志位存在');

    log('  ✓ 所有持久化UI元素验证通过');
  } catch (error) {
    assert(false, `筛选条件持久化UI测试失败: ${error.message}`);
  }
}

// Test 15: 快捷预设UI测试
async function testPresetUI() {
  log('\n测试 15: 快捷预设 UI', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check preset container
    assert(html.includes('id="presetContainer"'), '预设容器存在');
    assert(html.includes('class="preset-buttons"'), '预设按钮组存在');

    // Check built-in preset buttons
    assert(html.includes('🆕 最新数据'), '最新数据预设存在');
    assert(html.includes('🔥 市场热点'), '市场热点预设存在');
    assert(html.includes('📊 竞品分析'), '竞品分析预设存在');
    assert(html.includes('📅 本周数据'), '本周数据预设存在');
    assert(html.includes('🔄 全部数据'), '全部数据预设存在');

    // Check save preset button
    assert(html.includes('💾 保存为预设'), '保存预设按钮存在');
    assert(html.includes('id="customPresetsContainer"'), '自定义预设容器存在');

    // Check preset functions
    assert(html.includes('function applyPreset('), 'applyPreset 函数存在');
    assert(html.includes('function saveCustomPreset('), 'saveCustomPreset 函数存在');
    assert(html.includes('function loadCustomPresets('), 'loadCustomPresets 函数存在');
    assert(html.includes('function deleteCustomPreset('), 'deleteCustomPreset 函数存在');
    assert(html.includes('function renderCustomPresets('), 'renderCustomPresets 函数存在');

    // Check BUILTIN_PRESETS
    assert(html.includes('BUILTIN_PRESETS'), 'BUILTIN_PRESETS 配置存在');
    assert(html.includes('CUSTOM_PRESETS_KEY'), 'CUSTOM_PRESETS_KEY 常量存在');

    // Check CSS classes
    assert(html.includes('.preset-container'), '预设容器样式存在');
    assert(html.includes('.preset-btn'), '预设按钮样式存在');
    assert(html.includes('.custom-preset-btn'), '自定义预设按钮样式存在');

    log('  ✓ 所有预设UI元素验证通过');
  } catch (error) {
    assert(false, `快捷预设UI测试失败: ${error.message}`);
  }
}

// Test 16: 恢复提示条UI测试
async function testRestoreBannerUI() {
  log('\n测试 16: 恢复提示条 UI', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check restore banner HTML
    assert(html.includes('id="filterRestoreBanner"'), '恢复提示条存在');
    assert(html.includes('class="filter-restore-banner"'), '提示条class存在');
    assert(html.includes('检测到上次筛选条件，是否恢复'), '提示文案正确');

    // Check buttons
    assert(html.includes('恢复'), '恢复按钮存在');
    assert(html.includes('忽略'), '忽略按钮存在');
    assert(html.includes('不再提示'), '不再提示选项存在');
    assert(html.includes('id="dontShowAgainCheckbox"'), '不再提示checkbox存在');

    // Check functions
    assert(html.includes('function shouldShowRestoreBanner('), 'shouldShowRestoreBanner 函数存在');
    assert(html.includes('function showRestoreBanner('), 'showRestoreBanner 函数存在');
    assert(html.includes('function hideRestoreBanner('), 'hideRestoreBanner 函数存在');
    assert(html.includes('function restoreLastFilter('), 'restoreLastFilter 函数存在');
    assert(html.includes('function ignoreRestoreBanner('), 'ignoreRestoreBanner 函数存在');

    // Check constants
    assert(html.includes('DONT_SHOW_RESTORE_KEY'), 'DONT_SHOW_RESTORE_KEY 常量存在');

    // Check CSS classes
    assert(html.includes('.filter-restore-banner'), '提示条样式存在');
    assert(html.includes('.banner-actions'), '按钮组样式存在');

    log('  ✓ 所有恢复提示条UI元素验证通过');
  } catch (error) {
    assert(false, `恢复提示条UI测试失败: ${error.message}`);
  }
}

// Test 13: 批量操作UI测试
async function testBatchOperationsUI() {
  log('\n测试 13: 批量操作 UI 元素', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check checkbox elements
    assert(html.includes('id="selectAllCheckbox"'), '全选checkbox存在');
    assert(html.includes('class="file-checkbox"'), '文件checkbox样式存在');

    // Check selection info
    assert(html.includes('id="selectionInfo"'), '选择信息区域存在');
    assert(html.includes('id="selectionCount"'), '选择数量显示存在');

    // Check batch operation buttons
    assert(html.includes('id="batchOperations"'), '批量操作按钮组存在');
    assert(html.includes('class="btn-batch-delete"'), '批量删除按钮存在');
    assert(html.includes('class="btn-batch-action"'), '批量操作按钮样式存在');
    assert(html.includes('class="btn-clear-selection"'), '取消选择按钮存在');

    // Check delete modal
    assert(html.includes('id="deleteModal"'), '删除确认弹窗存在');
    assert(html.includes('class="delete-modal-content"'), '删除弹窗内容区域存在');
    assert(html.includes('id="deleteCount"'), '删除数量显示存在');
    assert(html.includes('id="deleteFileList"'), '删除文件列表存在');
    assert(html.includes('id="deleteVerificationInput"'), '删除验证输入框存在');
    assert(html.includes('id="confirmDeleteBtn"'), '确认删除按钮存在');

    // Check JavaScript functions
    assert(html.includes('function handleSelectAll('), 'handleSelectAll 函数存在');
    assert(html.includes('function handleSelectFile('), 'handleSelectFile 函数存在');
    assert(html.includes('function updateSelectionUI('), 'updateSelectionUI 函数存在');
    assert(html.includes('function clearSelection('), 'clearSelection 函数存在');
    assert(html.includes('function showDeleteConfirmModal('), 'showDeleteConfirmModal 函数存在');
    assert(html.includes('function hideDeleteConfirmModal('), 'hideDeleteConfirmModal 函数存在');
    assert(html.includes('function confirmDelete('), 'confirmDelete 函数存在');
    assert(html.includes('function handleBatchDownloadSelected('), 'handleBatchDownloadSelected 函数存在');
    assert(html.includes('function handleBatchExportSelected('), 'handleBatchExportSelected 函数存在');

    // Check CSS classes
    assert(html.includes('.file-checkbox'), 'checkbox样式存在');
    assert(html.includes('.file-row.selected'), '选中行样式存在');
    assert(html.includes('.selection-info'), '选择信息样式存在');
    assert(html.includes('.batch-operations'), '批量操作样式存在');
    assert(html.includes('.delete-modal'), '删除弹窗样式存在');

    log('  ✓ 所有批量操作UI元素验证通过');
  } catch (error) {
    assert(false, `批量操作UI测试失败: ${error.message}`);
  }
}

// Test 17: 趋势统计UI测试
async function testTrendStatisticsUI() {
  log('\n测试 17: 趋势统计 UI', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check new stat cards
    assert(html.includes('id="statTodayNew"'), '今日新增卡片存在');
    assert(html.includes('id="statWeekNew"'), '本周新增卡片存在');
    assert(html.includes('id="statTodayTrend"'), '今日趋势指示器存在');
    assert(html.includes('id="statWeekTrend"'), '本周趋势指示器存在');

    // Check trend calculation functions
    assert(html.includes('function aggregateByDay('), 'aggregateByDay 函数存在');
    assert(html.includes('function filterByTimeRange('), 'filterByTimeRange 函数存在');
    assert(html.includes('function getTodayCount('), 'getTodayCount 函数存在');
    assert(html.includes('function getYesterdayCount('), 'getYesterdayCount 函数存在');
    assert(html.includes('function getThisWeekCount('), 'getThisWeekCount 函数存在');
    assert(html.includes('function getLastWeekCount('), 'getLastWeekCount 函数存在');
    assert(html.includes('function calculateTrendPercent('), 'calculateTrendPercent 函数存在');
    assert(html.includes('function getTrendDirection('), 'getTrendDirection 函数存在');
    assert(html.includes('function updateTrendStatistics('), 'updateTrendStatistics 函数存在');

    // Check CSS classes
    assert(html.includes('.stat-trend'), '趋势样式存在');
    assert(html.includes('.trend-indicator'), '趋势指示器样式存在');
    assert(html.includes('.trend-up'), '上升趋势样式存在');
    assert(html.includes('.trend-down'), '下降趋势样式存在');
    assert(html.includes('.trend-stable'), '持平趋势样式存在');

    // Check icons
    assert(html.includes('📈'), '今日新增图标存在');
    assert(html.includes('📅'), '本周新增图标存在');

    log('  ✓ 所有趋势统计UI元素验证通过');
  } catch (error) {
    assert(false, `趋势统计UI测试失败: ${error.message}`);
  }
}

// Test 18: Canvas趋势图表UI测试
async function testCanvasChartUI() {
  log('\n测试 18: Canvas趋势图表 UI', colors.blue);
  try {
    const res = await makeRequest('/');
    assert(res.statusCode === 200, '页面加载成功');

    const html = res.body;

    // Check canvas container and elements
    assert(html.includes('id="trendChartContainer"'), 'Canvas图表容器存在');
    assert(html.includes('id="trendChart"'), 'Canvas元素存在');
    assert(html.includes('id="canvasTooltip"'), 'Canvas tooltip存在');

    // Check time range selector
    assert(html.includes('class="time-range-selector"'), '时间范围选择器存在');
    assert(html.includes('class="time-range-btn'), '时间范围按钮存在');
    assert(html.includes('data-days="7"'), '7天按钮存在');
    assert(html.includes('data-days="30"'), '30天按钮存在');

    // Check JavaScript functions
    assert(html.includes('function drawTrendChart('), 'drawTrendChart 函数存在');
    assert(html.includes('function switchTimeRange('), 'switchTimeRange 函数存在');
    assert(html.includes('function updateTrendChart('), 'updateTrendChart 函数存在');
    assert(html.includes('function setupCanvasInteraction('), 'setupCanvasInteraction 函数存在');
    assert(html.includes('function formatChartDate('), 'formatChartDate 函数存在');

    // Check CSS styles
    assert(html.includes('#trendChartContainer'), 'Canvas容器样式存在');
    assert(html.includes('#trendChart'), 'Canvas元素样式存在');
    assert(html.includes('.time-range-btn'), '时间按钮样式存在');
    assert(html.includes('#canvasTooltip'), 'Canvas tooltip样式存在');

    // Check function calls
    assert(html.includes('updateTrendChart()'), '图表更新调用存在');
    assert(html.includes('setupCanvasInteraction()'), '交互设置调用存在');

    log('  ✓ 所有Canvas趋势图表UI元素验证通过');
  } catch (error) {
    assert(false, `Canvas趋势图表UI测试失败: ${error.message}`);
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
  await testExcelExport();
  await testBatchExcelExport();
  await testPreviewAPI();
  await testScrapeAPI();
  await testSearchFilterUI();
  await testDeleteAPI();
  await testBatchOperationsUI();
  await testFilterPersistenceUI();
  await testPresetUI();
  await testRestoreBannerUI();
  await testTrendStatisticsUI();
  await testCanvasChartUI();

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
