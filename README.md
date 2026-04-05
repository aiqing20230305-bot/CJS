# 超级数据 - 数据抓取与分析工具

基于 Google Gemini CLI 的智能数据抓取系统，支持网页内容提取、搜索爬取、趋势分析。

## 功能特性

### 🌐 网页内容抓取
- 智能提取页面标题、正文、元信息
- 自动识别图片、视频等媒体资源
- 结构化 JSON 输出

### 🔍 关键词搜索
- Google Search 实时搜索
- 支持指定平台过滤（小红书、抖音、微博等）
- 批量结果提取

### 📊 趋势分析
- 多平台内容趋势对比
- 热度变化追踪
- 爆款内容特征识别

### 📦 批量处理
- 支持 URL 列表批量抓取
- 自动去重和错误处理
- 进度追踪

## 安装

```bash
# 已安装依赖
npm install
```

## 使用方法

### 1️⃣ 单页面抓取

```bash
node scraper.js fetch "https://example.com"
```

**输出示例：**
```json
{
  "title": "页面标题",
  "url": "https://example.com",
  "publishDate": "2026-04-05",
  "content": "主要内容...",
  "images": ["image1.jpg", "image2.jpg"],
  "keyPoints": ["要点1", "要点2"]
}
```

### 2️⃣ 关键词搜索

```bash
# 全网搜索
node scraper.js search "AI视频生成工具"

# 指定平台搜索
node scraper.js search "穿搭" --platform="小红书" --max=10
```

**参数：**
- `--platform` - 指定平台（小红书/抖音/微博/全网）
- `--max` - 最大结果数（默认 5）

### 3️⃣ 趋势分析

```bash
node scraper.js trends "AI绘画" --days=7 --platforms="小红书,抖音"
```

**参数：**
- `--days` - 分析天数（默认 7）
- `--platforms` - 分析平台（逗号分隔）

**输出示例：**
```json
{
  "topic": "AI绘画",
  "period": "7天",
  "trends": [
    {
      "platform": "小红书",
      "heatIndex": 92,
      "contentTypes": ["图文", "视频教程"],
      "topKeywords": ["Midjourney", "Stable Diffusion"],
      "viralPatterns": ["对比效果", "保姆级教程"]
    }
  ],
  "summary": "整体趋势..."
}
```

### 4️⃣ 批量抓取

**创建 URL 列表文件：**
```bash
cat > urls.txt << EOF
https://example1.com
https://example2.com
https://example3.com
EOF
```

**执行批量抓取：**
```bash
node scraper.js batch urls.txt
```

## 作为模块使用

```javascript
import { fetchWebContent, searchAndFetch, analyzeTrends } from './scraper.js';

// 抓取网页
const data = await fetchWebContent('https://example.com');

// 搜索
const results = await searchAndFetch('关键词', { 
  platform: '小红书',
  maxResults: 10 
});

// 趋势分析
const trends = await analyzeTrends('AI视频', {
  days: 7,
  platforms: ['小红书', '抖音']
});
```

## 数据输出

所有抓取的数据保存在 `./data/` 目录：

```
data/
├── fetch_1735678901234.json      # 单页面抓取
├── search_关键词_1735678901234.json  # 搜索结果
├── trends_话题_1735678901234.json   # 趋势分析
└── batch_1735678901234.json       # 批量抓取
```

## 应用场景

### 📱 电商内容策略
```bash
# 分析竞品内容趋势
node scraper.js trends "护肤品推荐" --days=14 --platforms="小红书,抖音"

# 搜索爆款内容
node scraper.js search "护肤品种草" --platform="小红书" --max=20
```

### 📰 舆情监控
```bash
# 抓取品牌相关内容
node scraper.js search "品牌名 评价" --max=50

# 分析话题热度
node scraper.js trends "品牌事件" --days=7
```

### 🎬 内容创作
```bash
# 分析热门视频特征
node scraper.js trends "短剧" --platforms="抖音,快手"

# 搜索创意灵感
node scraper.js search "视频脚本模板" --max=10
```

## 集成到超级洞察

与超级洞察项目的集成示例：

```javascript
import { analyzeTrends } from './scraper.js';

// 在超级洞察的数据采集节点中使用
async function collectMarketData(topic) {
  const trends = await analyzeTrends(topic, {
    days: 14,
    platforms: ['小红书', '抖音', '微博']
  });
  
  // 传递给下游分析节点
  return JSON.parse(trends);
}
```

## 注意事项

⚠️ **使用规范：**
1. 遵守目标网站的 robots.txt
2. 控制抓取频率，避免过载
3. 仅用于合法的数据分析用途
4. 注意数据隐私保护

⚠️ **Gemini CLI 配置：**
- 首次使用需配置 Google API Key
- 运行 `npx gemini` 进入交互式设置

## 技术栈

- **Gemini CLI** - Google AI 工具
- **Node.js** - 运行环境
- **ES Modules** - 模块化

## 更新日志

- **2026-04-05** - 初始版本
  - 单页面抓取
  - 关键词搜索
  - 趋势分析
  - 批量处理

## License

ISC
