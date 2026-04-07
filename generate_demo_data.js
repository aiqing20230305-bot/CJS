#!/usr/bin/env node
/**
 * 快速生成演示数据包
 * 用于测试和演示，不依赖Gemini API
 */

import fs from 'fs/promises';
import path from 'path';

async function generateDemoData(brand, category, competitors) {
  const timestamp = Date.now();
  const filename = `test_full_${brand}_${timestamp}.json`;

  const demoData = {
    type: "full_dataset",
    brand,
    category,
    competitors: competitors || ["竞品A", "竞品B"],
    generatedAt: new Date().toISOString(),
    status: "demo_data",
    message: "这是演示数据包，用于功能测试",
    data: {
      marketTrends: {
        topic: category,
        platforms: ["小红书", "抖音", "微博"],
        trends: [
          {
            platform: "小红书",
            heatIndex: Math.floor(Math.random() * 20) + 80,
            topKeywords: [`${brand}`, `${category}推荐`, "好用"],
            contentTypes: ["图文", "视频"]
          },
          {
            platform: "抖音",
            heatIndex: Math.floor(Math.random() * 20) + 85,
            topKeywords: [`${category}种草`, "测评", "对比"],
            contentTypes: ["短视频", "直播"]
          },
          {
            platform: "微博",
            heatIndex: Math.floor(Math.random() * 15) + 70,
            topKeywords: [`${brand}官方`, "活动", "新品"],
            contentTypes: ["图文", "话题"]
          }
        ],
        summary: `${category}类目在过去7天热度持续上升，小红书和抖音为主要流量平台`
      },
      viralVideos: {
        count: Math.floor(Math.random() * 10) + 10,
        topVideos: [
          {
            title: `${brand}${category}测评`,
            views: Math.floor(Math.random() * 500000) + 100000,
            likes: Math.floor(Math.random() * 50000) + 10000,
            platform: "抖音",
            author: "测评达人",
            publishDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          {
            title: `${category}使用教程`,
            views: Math.floor(Math.random() * 300000) + 80000,
            likes: Math.floor(Math.random() * 30000) + 8000,
            platform: "小红书",
            author: "美妆博主",
            publishDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          {
            title: `${brand}新品开箱`,
            views: Math.floor(Math.random() * 200000) + 50000,
            likes: Math.floor(Math.random() * 20000) + 5000,
            platform: "抖音",
            author: "种草博主",
            publishDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ],
        insights: {
          goldThreeSeconds: [
            "问题引入：你还在用XX吗？",
            "场景化表达：早上洗脸的时候...",
            "价值对比：花同样的钱，为什么不..."
          ],
          keyPatterns: ["前3秒钩子", "场景化演示", "对比值感"]
        }
      },
      competitors: {
        list: competitors || ["竞品A", "竞品B"],
        comparison: competitors?.reduce((acc, comp) => {
          acc[comp] = {
            marketShare: `${Math.floor(Math.random() * 20) + 10}%`,
            avgPrice: Math.floor(Math.random() * 100) + 50,
            rating: (Math.random() * 0.5 + 4.0).toFixed(1),
            monthlySales: Math.floor(Math.random() * 10000) + 5000,
            topProducts: [
              `${comp}明星产品A`,
              `${comp}爆款产品B`
            ]
          };
          return acc;
        }, {}) || {}
      },
      categoryReport: {
        marketSize: `${Math.floor(Math.random() * 50) + 50}亿元`,
        growthRate: `${(Math.random() * 20 + 10).toFixed(1)}%`,
        mainAudience: "25-35岁女性",
        topBrands: [brand, ...competitors].slice(0, 3),
        consumptionTrends: [
          "成分党崛起，关注产品配方",
          "功效细分，精准需求匹配",
          "国货崛起，性价比优势"
        ]
      },
      insights: {
        recommendation: `建议重点投放小红书和抖音平台，聚焦${category}核心功效卖点`,
        targetAudience: "25-35岁女性用户，注重品质和性价比",
        bestTimeToPost: "晚上8-10点，早上7-9点",
        contentStrategy: [
          "前3秒用问题钩子吸引注意",
          "场景化演示产品使用",
          "突出性价比和功效对比"
        ],
        keyOpportunities: [
          `${category}细分赛道仍有增长空间`,
          "短视频内容红利期，抓住流量窗口",
          "用户更关注真实测评和对比内容"
        ]
      }
    },
    metadata: {
      dataSource: "演示数据生成器",
      processingTime: "即时生成",
      fileSize: `${(JSON.stringify({})).length / 1024}KB`,
      note: "这是演示数据，实际生产环境需要连接真实API"
    }
  };

  // 保存到data目录
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });

  const filepath = path.join(dataDir, filename);
  await fs.writeFile(filepath, JSON.stringify(demoData, null, 2));

  console.log(`✅ 演示数据已生成！`);
  console.log(`📁 文件: ${filename}`);
  console.log(`📊 品牌: ${brand}`);
  console.log(`🏷️  类目: ${category}`);
  console.log(`🎯 竞品: ${competitors?.join(', ') || '竞品A, 竞品B'}`);
  console.log(`\n💡 提示: 刷新浏览器查看新数据包`);

  return filepath;
}

// CLI入口
const args = process.argv.slice(2);
const brand = args[0] || '演示品牌';
const category = args[1] || '演示类目';
const competitors = args[2]?.split(',') || ['竞品A', '竞品B'];

generateDemoData(brand, category, competitors).catch(console.error);
