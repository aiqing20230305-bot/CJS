# 快速开始

## ✅ 系统已就绪

- ✅ Gemini CLI: v0.36.0
- ✅ API Key: 已配置
- ✅ 依赖: 已安装
- ✅ 测试: 验证通过

---

## 🚀 立即使用

### 1. 验证配置（可选）

```bash
node test_direct.js
```

应该看到所有 ✅ 标记。

### 2. 开始使用

#### 搜索数据

```bash
node scraper.js search "AI视频工具" --max=5
```

**参数**:
- `--platform="小红书"` - 指定平台
- `--max=10` - 最大结果数

#### 趋势分析

```bash
node scraper.js trends "短视频" --days=7
```

**参数**:
- `--days=14` - 分析天数
- `--platforms="小红书,抖音"` - 指定平台

#### 单页抓取

```bash
node scraper.js fetch "https://news.ycombinator.com"
```

#### 批量抓取

```bash
node scraper.js batch example_urls.txt
```

---

## 🎯 超级洞察集成

### 快速采集

```bash
node integrations/super-insight.js market "多芬" "洗护"
```

**命令**:
- `market` - 市场热点
- `videos` - 爆款视频
- `competitors` - 竞品分析
- `full` - 完整数据包

### 完整数据包

```bash
node integrations/super-insight.js full \
  --brand="多芬" \
  --category="洗护" \
  --competitors="凡士林,妮维雅"
```

**输出**:
```
data/super-insight/
├── full_dataset_*.json       # 原始数据
└── agent_input_*.json        # Agent 格式
```

---

## 📝 使用示例

### 示例 1: 电商内容策略

```bash
# 1. 采集市场热点
node integrations/super-insight.js market "护肤品" "面霜"

# 2. 分析爆款视频
node integrations/super-insight.js videos "护肤品种草"

# 3. 竞品分析
node integrations/super-insight.js competitors "雅诗兰黛,兰蔻" "面霜"
```

### 示例 2: 趋势监控

```bash
# 每日趋势
node scraper.js trends "AI工具" --days=1

# 周趋势
node scraper.js trends "短视频" --days=7

# 月趋势
node scraper.js trends "电商直播" --days=30
```

### 示例 3: 批量处理

创建 URL 列表：
```bash
cat > my_urls.txt << EOF
https://news.ycombinator.com
https://github.com/trending
https://www.producthunt.com
EOF
```

批量抓取：
```bash
node scraper.js batch my_urls.txt
```

---

## 🧪 测试工具

| 命令 | 说明 |
|------|------|
| `node test_direct.js` | 快速验证 ✅ |
| `node quick_test.js` | 配置检查 |
| `node test_without_api.js` | 功能测试 |
| `node final_test.js` | 实际测试（API调用）|
| `node example_super_insight.js` | 完整示例 |

---

## 📁 输出位置

所有数据保存在 `./data/` 目录：

```
data/
├── fetch_*.json              # 单页抓取
├── search_*.json            # 搜索结果
├── trends_*.json            # 趋势分析
├── batch_*.json             # 批量抓取
└── super-insight/
    ├── market_trends_*.json
    ├── viral_videos_*.json
    └── full_dataset_*.json
```

---

## ⚡ 快捷命令

在 `package.json` 中已配置：

```bash
npm run search "关键词"
npm run trends "话题"
npm run fetch "URL"
npm run batch urls.txt
```

---

## 🔧 便捷脚本

使用 `run.sh`（自动加载 .env）：

```bash
./run.sh scraper.js search "关键词"
```

---

## 📊 性能建议

### 控制频率

```bash
# 小批量测试
--max=3

# 中等批量
--max=10

# 大批量（注意配额）
--max=20
```

### 时间范围

```bash
# 最近趋势
--days=7

# 中期趋势
--days=14

# 长期趋势
--days=30
```

---

## ⚠️ 注意事项

1. **API 配额**
   - 注意 Gemini API 免费配额限制
   - 建议分批处理大量数据

2. **抓取频率**
   - 批量抓取自动控制间隔（2秒）
   - 避免短时间内大量请求

3. **数据存储**
   - 定期清理 `./data/` 目录
   - 每次抓取约 1-5MB

---

## 🆘 遇到问题？

### 问题 1: API 调用失败

**检查**:
```bash
node quick_test.js
cat ~/.gemini/settings.json
```

**解决**: 重新配置 API Key
```bash
npx @google/gemini-cli
```

### 问题 2: 找不到命令

**检查**:
```bash
ls -lh scraper.js
npm list @google/gemini-cli
```

**解决**: 重新安装
```bash
npm install
```

### 问题 3: 数据未生成

**检查**:
```bash
ls -lh data/
```

**解决**: 查看错误日志，检查 API Key

---

## 📚 完整文档

- [README.md](./README.md) - 完整功能文档
- [SETUP.md](./SETUP.md) - 配置指南
- [API_CONFIG.md](./API_CONFIG.md) - API 配置
- [STATUS.md](./STATUS.md) - 项目状态
- [integrations/README.md](./integrations/README.md) - 集成文档

---

## 🔗 资源链接

- **GitHub**: https://github.com/aiqing20230305-bot/CJS
- **Gemini CLI**: https://github.com/google-gemini/gemini-cli
- **API Key**: https://aistudio.google.com/app/apikey

---

**准备就绪！开始使用吧！** 🚀
