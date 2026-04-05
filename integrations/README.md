# 超级洞察集成

将数据抓取能力集成到超级洞察项目的数据采集流程。

## 功能概述

自动采集超级洞察所需的全部数据源：
- ✅ **Agent1**: 爆款视频数据（日榜/月榜、分镜拆解、黄金3秒）
- ✅ **Agent2**: 市场热点数据（平台热点、品类热点、热销属性）
- ✅ **Agent3**: 竞品商品数据（SKU 销量、转化率）
- ✅ **品类报告**: 市场规模、人群画像、搜索指数

## 快速开始

### 一键采集完整数据包

```bash
node integrations/super-insight.js full \
  --brand="多芬" \
  --category="洗护" \
  --competitors="凡士林,妮维雅"
```

**输出：**
```
data/super-insight/
├── full_dataset_多芬_1735678901234.json    # 原始数据
└── agent_input_1735678901234.json          # Agent 格式数据
```

### 单独采集各类数据

#### 1. 市场热点数据（Agent2）

```bash
node integrations/super-insight.js market "多芬" "洗护"
```

采集内容：
- 平台热点趋势（小红书/抖音/微博）
- 品类电商热点
- 热销属性（功效/成分/人群）

#### 2. 爆款视频数据（Agent1）

```bash
node integrations/super-insight.js videos "护肤品种草"
```

采集内容：
- 爆款视频列表
- 视频特征分析
- 内容策略洞察

#### 3. 竞品分析数据（Agent3）

```bash
node integrations/super-insight.js competitors "凡士林,妮维雅" "护肤"
```

采集内容：
- 竞品销量数据
- 用户评价
- 转化率对比

## 作为模块使用

```javascript
import SuperInsightCollector from './integrations/super-insight.js';

const collector = new SuperInsightCollector({
  outputDir: './data/super-insight',
  platforms: ['小红书', '抖音', '微博']
});

// 一键采集
const fullData = await collector.collectFullDataset({
  brand: '多芬',
  category: '洗护',
  competitors: ['凡士林', '妮维雅'],
  keywords: '洗护套装'
});

// 转换为 Agent 输入格式
const agentInput = await collector.convertToAgentFormat(fullData);
```

## 数据格式

### Agent 输入格式

```json
{
  "agent1": {
    "日榜": [...],
    "分镜拆解": [...],
    "黄金3秒台词": [...]
  },
  "agent2": {
    "平台热点": [...],
    "品类电商热点": [...],
    "热销属性": [...]
  },
  "agent3": {
    "竞品SKU": [...]
  },
  "categoryReport": {...}
}
```

### 完整数据包格式

```json
{
  "startTime": "2026-04-05T15:00:00Z",
  "endTime": "2026-04-05T15:10:00Z",
  "status": "success",
  "config": {
    "brand": "多芬",
    "category": "洗护",
    "competitors": ["凡士林", "妮维雅"]
  },
  "data": {
    "marketTrends": {...},
    "viralVideos": {...},
    "competitors": {...},
    "categoryReport": {...}
  }
}
```

## 集成到超级洞察

### 方案 1：替换数据解析节点

在超级洞察的数据解析节点中：

```javascript
// 原来：手动上传 agent1.xlsx, agent2.xlsx, agent3.xlsx
// 现在：自动采集并解析

import SuperInsightCollector from '../../超级数据/integrations/super-insight.js';

async function parseNode(brand, category) {
  const collector = new SuperInsightCollector();
  
  // 采集数据
  const fullData = await collector.collectFullDataset({
    brand,
    category,
    competitors: ['竞品A', '竞品B']
  });
  
  // 转换格式
  const agentInput = await collector.convertToAgentFormat(fullData);
  
  // 传递给洞察节点
  return agentInput;
}
```

### 方案 2：增强现有流程

保留手动上传 Excel，增加自动补充：

```javascript
async function enhanceWithWebData(uploadedData, brand, category) {
  const collector = new SuperInsightCollector();
  
  // 采集补充数据
  const webData = await collector.collectMarketTrends(brand, category);
  
  // 合并数据
  return {
    uploaded: uploadedData,
    webEnhanced: webData
  };
}
```

## 工作流示例

### 完整流程

```bash
# 1. 采集数据
node integrations/super-insight.js full \
  --brand="多芬" \
  --category="洗护" \
  --competitors="凡士林,妮维雅"

# 2. 查看输出
cat data/super-insight/agent_input_*.json

# 3. 在超级洞察中使用
# 将 agent_input_*.json 导入到解析节点
```

### 定时更新

使用 cron 定时采集：

```bash
# 每天早上 9 点采集
0 9 * * * cd /path/to/超级数据 && node integrations/super-insight.js full --brand="多芬" --category="洗护"
```

## API 参考

### SuperInsightCollector

**构造函数**

```javascript
new SuperInsightCollector(options)
```

- `options.outputDir` - 输出目录（默认：`./data/super-insight`）
- `options.platforms` - 平台列表（默认：`['小红书', '抖音', '微博']`）

**方法**

| 方法 | 说明 | 参数 |
|------|------|------|
| `collectMarketTrends(brand, category, options)` | 采集市场热点 | brand, category, {days} |
| `collectViralVideos(keywords, options)` | 采集爆款视频 | keywords, {platform, maxResults} |
| `collectCompetitorData(competitors, category)` | 采集竞品数据 | competitors[], category |
| `collectCategoryReport(category)` | 采集品类报告 | category |
| `collectFullDataset(config)` | 一键采集全部 | {brand, category, competitors, keywords} |
| `convertToAgentFormat(fullDataset)` | 转换格式 | fullDataset |

## 注意事项

1. **API 配置**：首次使用需配置 Gemini API Key
2. **采集频率**：建议每天采集 1-2 次，避免过载
3. **数据时效**：数据实时性取决于搜索引擎更新
4. **存储空间**：每次完整采集约 5-10MB 数据

## 后续优化

- [ ] 支持更多平台（快手、B站）
- [ ] 增加数据去重和清洗
- [ ] 添加可视化报表
- [ ] 集成到超级洞察前端界面
- [ ] 支持增量更新

## 相关文档

- [超级数据 README](../README.md)
- [超级洞察项目文档](../../超级洞察/README.md)
- [数据格式说明](./DATA_FORMAT.md)
