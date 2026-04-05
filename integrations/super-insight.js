/**
 * 超级洞察集成模块
 * 将数据抓取能力集成到超级洞察的数据采集流程
 */

import { fetchWebContent, searchAndFetch, analyzeTrends } from '../scraper.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 超级洞察数据采集器
 * 用于采集市场热点、爆款视频、竞品分析数据
 */
export class SuperInsightCollector {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './data/super-insight';
    this.platforms = options.platforms || ['小红书', '抖音', '微博'];
  }

  /**
   * 采集市场热点数据
   * 对应 agent2.xlsx 的数据源
   */
  async collectMarketTrends(brand, category, options = {}) {
    const { days = 14 } = options;

    console.log(`\n📊 采集市场热点: ${brand} - ${category}`);

    // 1. 平台热点
    const platformTrends = await analyzeTrends(category, {
      days,
      platforms: this.platforms
    });

    // 2. 品类电商热点
    const categoryHotspots = await searchAndFetch(
      `${category} 电商爆款`,
      { platform: '全网', maxResults: 10 }
    );

    // 3. 热销属性（功效/成分/人群）
    const attributes = await searchAndFetch(
      `${category} 功效成分热门`,
      { platform: '小红书', maxResults: 15 }
    );

    const data = {
      brand,
      category,
      period: `${days}天`,
      collectedAt: new Date().toISOString(),
      platformTrends: JSON.parse(platformTrends),
      categoryHotspots: JSON.parse(categoryHotspots),
      attributes: JSON.parse(attributes),
      summary: this._generateMarketSummary(platformTrends, categoryHotspots)
    };

    await this._saveData(data, `market_trends_${brand}_${Date.now()}.json`);
    return data;
  }

  /**
   * 采集爆款视频数据
   * 对应 agent1.xlsx 的数据源
   */
  async collectViralVideos(keywords, options = {}) {
    const { platform = '抖音', maxResults = 20 } = options;

    console.log(`\n🎬 采集爆款视频: ${keywords}`);

    // 搜索爆款视频
    const videos = await searchAndFetch(
      `${keywords} 爆款视频`,
      { platform, maxResults }
    );

    // 分析视频特征
    const analysis = await analyzeTrends(keywords, {
      days: 7,
      platforms: [platform]
    });

    const data = {
      keywords,
      platform,
      collectedAt: new Date().toISOString(),
      videos: JSON.parse(videos),
      analysis: JSON.parse(analysis),
      insights: this._extractVideoInsights(videos, analysis)
    };

    await this._saveData(data, `viral_videos_${keywords}_${Date.now()}.json`);
    return data;
  }

  /**
   * 采集竞品商品数据
   * 对应 agent3.xlsx 的数据源
   */
  async collectCompetitorData(competitors, category, options = {}) {
    console.log(`\n🎯 采集竞品数据: ${competitors.join(', ')}`);

    const results = [];

    for (const competitor of competitors) {
      const data = await searchAndFetch(
        `${competitor} ${category} 销量 评价`,
        { platform: '全网', maxResults: 10 }
      );

      results.push({
        competitor,
        category,
        data: JSON.parse(data),
        collectedAt: new Date().toISOString()
      });

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const summary = {
      competitors,
      category,
      results,
      comparison: this._compareCompetitors(results)
    };

    await this._saveData(summary, `competitors_${category}_${Date.now()}.json`);
    return summary;
  }

  /**
   * 采集品类报告数据
   * 对应蝉妈妈报告的补充数据
   */
  async collectCategoryReport(category, options = {}) {
    console.log(`\n📈 采集品类报告: ${category}`);

    // 1. 市场规模和趋势
    const marketSize = await searchAndFetch(
      `${category} 市场规模 行业报告`,
      { platform: '全网', maxResults: 5 }
    );

    // 2. 人群画像
    const audience = await searchAndFetch(
      `${category} 用户画像 消费者分析`,
      { platform: '全网', maxResults: 5 }
    );

    // 3. 搜索指数趋势
    const searchTrends = await analyzeTrends(category, {
      days: 30,
      platforms: ['小红书', '抖音']
    });

    const data = {
      category,
      collectedAt: new Date().toISOString(),
      marketSize: JSON.parse(marketSize),
      audience: JSON.parse(audience),
      searchTrends: JSON.parse(searchTrends),
      summary: this._generateCategorySummary(marketSize, audience, searchTrends)
    };

    await this._saveData(data, `category_report_${category}_${Date.now()}.json`);
    return data;
  }

  /**
   * 一键采集完整数据包
   * 采集超级洞察所需的全部数据源
   */
  async collectFullDataset(config) {
    const { brand, category, competitors, keywords } = config;

    console.log(`\n🚀 一键采集完整数据包`);
    console.log(`品牌: ${brand}`);
    console.log(`品类: ${category}`);
    console.log(`竞品: ${competitors.join(', ')}`);

    const results = {
      startTime: new Date().toISOString(),
      config,
      data: {}
    };

    try {
      // 1. 市场热点
      results.data.marketTrends = await this.collectMarketTrends(brand, category);

      // 2. 爆款视频
      results.data.viralVideos = await this.collectViralVideos(keywords || `${brand} ${category}`);

      // 3. 竞品分析
      results.data.competitors = await this.collectCompetitorData(competitors, category);

      // 4. 品类报告
      results.data.categoryReport = await this.collectCategoryReport(category);

      results.endTime = new Date().toISOString();
      results.status = 'success';

      await this._saveData(results, `full_dataset_${brand}_${Date.now()}.json`);

      console.log(`\n✅ 数据采集完成！`);
      console.log(`输出目录: ${this.outputDir}`);

      return results;
    } catch (error) {
      results.endTime = new Date().toISOString();
      results.status = 'error';
      results.error = error.message;

      console.error(`\n❌ 采集失败:`, error);
      throw error;
    }
  }

  /**
   * 转换为超级洞察的 Agent 输入格式
   */
  async convertToAgentFormat(fullDataset) {
    console.log(`\n🔄 转换为 Agent 输入格式`);

    // Agent1: 爆款视频数据
    const agent1 = this._formatAgent1Data(fullDataset.data.viralVideos);

    // Agent2: 市场热点数据
    const agent2 = this._formatAgent2Data(fullDataset.data.marketTrends);

    // Agent3: 竞品商品数据
    const agent3 = this._formatAgent3Data(fullDataset.data.competitors);

    const output = {
      agent1,
      agent2,
      agent3,
      categoryReport: fullDataset.data.categoryReport,
      generatedAt: new Date().toISOString()
    };

    await this._saveData(output, `agent_input_${Date.now()}.json`);

    console.log(`✅ 格式转换完成`);
    return output;
  }

  // ========== 私有方法 ==========

  _generateMarketSummary(trends, hotspots) {
    return {
      overview: '市场热点数据采集完成',
      trendCount: JSON.parse(trends).trends?.length || 0,
      hotspotCount: JSON.parse(hotspots).length || 0
    };
  }

  _extractVideoInsights(videos, analysis) {
    return {
      totalVideos: JSON.parse(videos).length || 0,
      platforms: JSON.parse(analysis).platforms || [],
      keyPatterns: '前3秒钩子、场景化表达、值感体现'
    };
  }

  _compareCompetitors(results) {
    return {
      count: results.length,
      comparison: '竞品销量、评价、人群对比'
    };
  }

  _generateCategorySummary(marketSize, audience, searchTrends) {
    return {
      marketData: JSON.parse(marketSize).length || 0,
      audienceData: JSON.parse(audience).length || 0,
      trends: JSON.parse(searchTrends).trends?.length || 0
    };
  }

  _formatAgent1Data(viralVideos) {
    // 格式化为 agent1.xlsx 的结构
    return {
      日榜: viralVideos.videos || [],
      分镜拆解: [],
      黄金3秒台词: []
    };
  }

  _formatAgent2Data(marketTrends) {
    // 格式化为 agent2.xlsx 的结构
    return {
      平台热点: marketTrends.platformTrends || [],
      品类电商热点: marketTrends.categoryHotspots || [],
      热销属性: marketTrends.attributes || []
    };
  }

  _formatAgent3Data(competitors) {
    // 格式化为 agent3.xlsx 的结构
    return {
      竞品SKU: competitors.results || []
    };
  }

  async _saveData(data, filename) {
    await fs.mkdir(this.outputDir, { recursive: true });
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`💾 已保存: ${filepath}`);
  }
}

/**
 * CLI 入口
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const collector = new SuperInsightCollector();

  try {
    switch (command) {
      case 'market':
        // 采集市场热点
        const brand = args[1] || '多芬';
        const category = args[2] || '洗护';
        await collector.collectMarketTrends(brand, category);
        break;

      case 'videos':
        // 采集爆款视频
        const keywords = args[1] || '护肤品';
        await collector.collectViralVideos(keywords);
        break;

      case 'competitors':
        // 采集竞品数据
        const competitors = args[1]?.split(',') || ['凡士林', '妮维雅'];
        const cat = args[2] || '护肤';
        await collector.collectCompetitorData(competitors, cat);
        break;

      case 'full':
        // 一键采集
        const config = {
          brand: args.find(a => a.startsWith('--brand='))?.split('=')[1] || '多芬',
          category: args.find(a => a.startsWith('--category='))?.split('=')[1] || '洗护',
          competitors: args.find(a => a.startsWith('--competitors='))?.split('=')[1]?.split(',') || ['凡士林', '妮维雅'],
          keywords: args.find(a => a.startsWith('--keywords='))?.split('=')[1]
        };
        const fullData = await collector.collectFullDataset(config);
        await collector.convertToAgentFormat(fullData);
        break;

      default:
        console.log(`超级洞察数据采集工具

使用方法：

📊 市场热点:
  node integrations/super-insight.js market "多芬" "洗护"

🎬 爆款视频:
  node integrations/super-insight.js videos "护肤品种草"

🎯 竞品分析:
  node integrations/super-insight.js competitors "凡士林,妮维雅" "护肤"

🚀 一键采集:
  node integrations/super-insight.js full --brand="多芬" --category="洗护" --competitors="凡士林,妮维雅"

输出目录: ./data/super-insight/
        `);
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SuperInsightCollector;
