#!/usr/bin/env node
/**
 * 超级洞察集成示例
 * 演示如何使用数据采集器采集完整数据包
 */

import SuperInsightCollector from './integrations/super-insight.js';

async function example() {
  console.log('🎯 超级洞察数据采集示例\n');

  const collector = new SuperInsightCollector({
    outputDir: './data/super-insight-example',
    platforms: ['小红书', '抖音', '微博']
  });

  try {
    // 示例配置
    const config = {
      brand: '多芬',
      category: '洗护',
      competitors: ['凡士林', '妮维雅', '施华蔻'],
      keywords: '洗护套装 护发'
    };

    console.log('📋 配置信息:');
    console.log(`  品牌: ${config.brand}`);
    console.log(`  品类: ${config.category}`);
    console.log(`  竞品: ${config.competitors.join(', ')}`);
    console.log(`  关键词: ${config.keywords}\n`);

    // 方案 1: 分步采集（推荐用于调试）
    console.log('📦 方案 1: 分步采集\n');

    // 1. 市场热点
    console.log('1️⃣ 采集市场热点...');
    const marketTrends = await collector.collectMarketTrends(
      config.brand,
      config.category,
      { days: 14 }
    );
    console.log(`✅ 完成！采集到 ${Object.keys(marketTrends).length} 个数据源\n`);

    // 2. 爆款视频
    console.log('2️⃣ 采集爆款视频...');
    const viralVideos = await collector.collectViralVideos(
      config.keywords,
      { platform: '抖音', maxResults: 10 }
    );
    console.log(`✅ 完成！采集到 ${viralVideos.videos?.length || 0} 个视频\n`);

    // 3. 竞品分析
    console.log('3️⃣ 采集竞品数据...');
    const competitors = await collector.collectCompetitorData(
      config.competitors,
      config.category
    );
    console.log(`✅ 完成！分析了 ${competitors.results.length} 个竞品\n`);

    // 4. 品类报告
    console.log('4️⃣ 采集品类报告...');
    const categoryReport = await collector.collectCategoryReport(config.category);
    console.log(`✅ 完成！生成品类报告\n`);

    // 方案 2: 一键采集（推荐用于生产）
    console.log('\n📦 方案 2: 一键采集\n');

    const fullData = await collector.collectFullDataset(config);
    console.log(`✅ 一键采集完成！`);
    console.log(`   状态: ${fullData.status}`);
    console.log(`   耗时: ${new Date(fullData.endTime) - new Date(fullData.startTime)} ms\n`);

    // 转换为 Agent 格式
    console.log('🔄 转换为 Agent 输入格式...');
    const agentInput = await collector.convertToAgentFormat(fullData);
    console.log(`✅ 格式转换完成！`);
    console.log(`   Agent1 数据: ${Object.keys(agentInput.agent1).length} 个表`);
    console.log(`   Agent2 数据: ${Object.keys(agentInput.agent2).length} 个表`);
    console.log(`   Agent3 数据: ${Object.keys(agentInput.agent3).length} 个表\n`);

    // 输出摘要
    console.log('📊 数据摘要:');
    console.log(`  市场热点趋势数: ${fullData.data.marketTrends?.platformTrends?.trends?.length || 0}`);
    console.log(`  爆款视频数: ${fullData.data.viralVideos?.videos?.length || 0}`);
    console.log(`  竞品数: ${fullData.data.competitors?.results?.length || 0}`);
    console.log(`  品类报告数据源: ${Object.keys(fullData.data.categoryReport || {}).length}\n`);

    console.log('✅ 示例执行完成！');
    console.log(`📁 数据保存在: ${collector.outputDir}\n`);

  } catch (error) {
    console.error('\n❌ 示例执行失败:', error.message);
    console.error('提示: 请确保已配置 Gemini API Key');
    console.error('配置方法: npx gemini (首次运行时设置)\n');
    process.exit(1);
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}
