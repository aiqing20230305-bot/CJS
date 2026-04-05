#!/usr/bin/env node
/**
 * 测试数据抓取功能
 */

import { searchAndFetch } from './scraper.js';

console.log('开始测试数据抓取...\n');

try {
  console.log('测试: 搜索 "AI工具"');
  const result = await searchAndFetch('AI工具', { maxResults: 2 });
  console.log('\n✅ 测试成功！');
  console.log('结果长度:', result.length);
  console.log('结果预览:', result.substring(0, 200));
} catch (error) {
  console.error('\n❌ 测试失败:', error.message);
  console.error('错误详情:', error);
}
