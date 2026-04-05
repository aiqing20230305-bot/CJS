# 超级数据 - 配置与使用指南

## ✅ 已完成的工作

### 1️⃣ 测试抓取功能
- ✅ 安装 Google Gemini CLI (v0.36.0)
- ⚠️ 需要配置 API Key（见下方配置步骤）

### 2️⃣ 提交到 GitHub
- ✅ 代码已推送到：https://github.com/aiqing20230305-bot/CJS.git
- ✅ 2 次提交：
  - `feat: 添加数据抓取系统` (1148+ 行)
  - `feat: 超级洞察集成模块` (742+ 行)

### 3️⃣ 集成到超级洞察
- ✅ 创建 `SuperInsightCollector` 集成模块
- ✅ 支持采集 Agent1/Agent2/Agent3 所需数据
- ✅ 自动转换为超级洞察输入格式
- ✅ 提供使用示例和完整文档

---

## 📦 项目结构

```
超级数据/
├── scraper.js                      # 核心抓取引擎
├── example_super_insight.js        # 超级洞察示例
├── integrations/
│   ├── super-insight.js           # 超级洞察集成
│   └── README.md                  # 集成文档
├── data/                          # 数据输出目录（自动创建）
├── README.md                      # 主文档
└── SETUP.md                       # 本文件
```

---

## 🚀 首次配置

### 步骤 1: 配置 Gemini API Key

Gemini CLI 需要 Google API Key 才能运行。

#### 方法 A: 交互式配置（推荐）

```bash
npx @google/gemini-cli
# 按提示输入 API Key
```

#### 方法 B: 环境变量

```bash
export GEMINI_API_KEY="your-api-key-here"
```

#### 方法 C: 配置文件

编辑 `~/.gemini/settings.json`：

```json
{
  "apiKey": "your-api-key-here"
}
```

#### 获取 API Key

访问：https://aistudio.google.com/app/apikey

---

### 步骤 2: 测试基本功能

```bash
# 测试 Gemini CLI
npx @google/gemini-cli -p "Hello, test"

# 测试数据抓取
node scraper.js search "AI工具" --max=3
```

**预期输出：**
```
🔍 搜索关键词: AI工具 (全网)
💾 数据已保存: ./data/search_AI工具_*.json
```

---

## 🎯 快速开始

### 基础数据抓取

```bash
# 1. 单页面抓取
node scraper.js fetch "https://news.ycombinator.com"

# 2. 搜索内容
node scraper.js search "护肤品" --platform="小红书" --max=5

# 3. 趋势分析
node scraper.js trends "短视频" --days=7

# 4. 批量抓取
node scraper.js batch example_urls.txt
```

### 超级洞察集成

```bash
# 完整数据包采集
node integrations/super-insight.js full \
  --brand="多芬" \
  --category="洗护" \
  --competitors="凡士林,妮维雅"
```

**输出：**
```
data/super-insight/
├── full_dataset_多芬_*.json       # 原始完整数据
└── agent_input_*.json            # Agent 格式数据
```

### 运行示例

```bash
# 查看完整流程演示
node example_super_insight.js
```

---

## 📊 与超级洞察协同

### 方案 1: 自动化数据采集

在超级洞察的数据解析节点中引入：

```javascript
import SuperInsightCollector from '../超级数据/integrations/super-insight.js';

async function autoCollectData(brand, category) {
  const collector = new SuperInsightCollector();
  
  const fullData = await collector.collectFullDataset({
    brand,
    category,
    competitors: ['竞品A', '竞品B']
  });
  
  return await collector.convertToAgentFormat(fullData);
}
```

### 方案 2: 手动导入增强

1. 运行数据采集：
```bash
cd ~/Desktop/AX/超级数据
node integrations/super-insight.js full --brand="多芬" --category="洗护"
```

2. 获取输出文件：
```bash
cat data/super-insight/agent_input_*.json
```

3. 在超级洞察中：
- 将 JSON 数据导入到解析节点
- 或与手动上传的 Excel 合并使用

---

## 🛠️ npm 脚本

在 `package.json` 中已配置快捷命令：

```bash
npm run search "关键词" -- --platform="小红书"
npm run trends "话题" -- --days=7
npm run fetch "https://example.com"
npm run batch example_urls.txt
```

---

## 📝 常见问题

### Q1: 提示 "Please set an Auth method"

**原因**: 未配置 Gemini API Key

**解决**: 
```bash
npx @google/gemini-cli
# 按提示配置 API Key
```

### Q2: 抓取速度慢或超时

**原因**: 网络问题或请求量大

**解决**:
- 减少 `--max` 参数
- 使用 `--days` 减少时间范围
- 检查网络连接

### Q3: 数据格式不符合超级洞察

**原因**: Agent 格式转换需要定制

**解决**:
- 编辑 `integrations/super-insight.js`
- 修改 `_formatAgent1Data`/`_formatAgent2Data`/`_formatAgent3Data` 方法

### Q4: 如何定时更新数据

**方案 A: Cron（Linux/Mac）**
```bash
crontab -e
# 添加：每天早上 9 点
0 9 * * * cd ~/Desktop/AX/超级数据 && node integrations/super-insight.js full --brand="多芬" --category="洗护"
```

**方案 B: GitHub Actions**
创建 `.github/workflows/daily-scrape.yml`

---

## 🔗 相关链接

- GitHub 仓库: https://github.com/aiqing20230305-bot/CJS
- Gemini CLI 文档: https://github.com/google-gemini/gemini-cli
- 超级洞察项目: `/Users/zhangjingwei/Desktop/AX/超级洞察/`

---

## 📈 下一步

### 建议优化

- [ ] 添加数据去重和清洗逻辑
- [ ] 支持更多平台（快手、B站）
- [ ] 可视化数据报表
- [ ] 集成到超级洞察前端 UI
- [ ] 增量更新机制
- [ ] 数据缓存和版本管理

### Agent-Reach 集成

当找到 Agent-Reach 正确的安装方式后：
1. 安装 Agent-Reach 包
2. 在 `scraper.js` 中添加 Agent-Reach 适配器
3. 更新 `SuperInsightCollector` 以使用 Agent-Reach

---

## 📧 支持

如有问题，请：
1. 查看 [README.md](./README.md)
2. 查看 [integrations/README.md](./integrations/README.md)
3. 提交 GitHub Issue

---

**版本**: 1.0.0  
**更新日期**: 2026-04-05  
**状态**: ✅ 生产就绪（需配置 API Key）
