# API 配置指南

## ✅ 已完成配置

Gemini API Key 已配置成功！

### 配置位置

**方法 1: 配置文件**
```bash
~/.gemini/settings.json
```

**方法 2: 环境变量**
```bash
# 项目根目录的 .env 文件
GEMINI_API_KEY=your-api-key-here
```

**方法 3: Shell 导出**
```bash
export GEMINI_API_KEY="your-api-key-here"
```

---

## 🚀 使用方式

### 方法 A: 直接使用（推荐）

如果已配置 `~/.gemini/settings.json` 或全局环境变量：

```bash
# 测试 Gemini CLI
npx @google/gemini-cli -p "Hello" --output-format text

# 使用数据抓取
node scraper.js search "AI工具" --max=3
```

### 方法 B: 使用 run.sh 脚本

自动加载项目 `.env` 文件：

```bash
./run.sh scraper.js search "AI工具" --max=3
```

### 方法 C: 临时指定

```bash
GEMINI_API_KEY="your-key" node scraper.js search "关键词"
```

---

## 🧪 测试 API 配置

### 快速测试

```bash
# 方法 1: 使用内置测试
node test_without_api.js

# 方法 2: 简单查询测试
export GEMINI_API_KEY="your-key"
npx @google/gemini-cli -p "1+1=?" --output-format text

# 方法 3: 数据抓取测试
node scraper.js search "测试" --max=1
```

### 完整功能测试

```bash
# 运行测试脚本（如果存在）
./test_api.sh

# 或者运行示例
node example_super_insight.js
```

---

## 📋 API Key 获取

访问: https://aistudio.google.com/app/apikey

1. 登录 Google 账号
2. 点击「Create API Key」
3. 复制生成的 API Key
4. 配置到上述任一位置

---

## 🔒 安全提示

⚠️ **重要**: API Key 是敏感信息

1. ✅ **DO**: 使用 `.env` 文件（已在 `.gitignore` 中）
2. ✅ **DO**: 使用 `~/.gemini/settings.json`（用户目录，不会提交）
3. ❌ **DON'T**: 提交 API Key 到 Git
4. ❌ **DON'T**: 在公共场合分享 API Key
5. ❌ **DON'T**: 硬编码到源代码中

### 已保护的文件

`.gitignore` 中已包含：
- `.env` - 环境变量文件
- `.gemini/` - Gemini 配置目录
- `test_api.sh` - 测试脚本（可能包含 Key）

---

## 🛠️ 常见问题

### Q: 提示 "Please set an Auth method"

**原因**: API Key 未正确配置

**解决**:
1. 检查 `~/.gemini/settings.json` 格式是否正确
2. 尝试使用环境变量方式
3. 重新运行 `npx @google/gemini-cli` 进行交互式配置

### Q: API 调用失败或超时

**原因**: 
- API Key 无效
- 网络问题
- 配额限制

**解决**:
1. 验证 API Key 是否正确
2. 检查网络连接
3. 查看 Google AI Studio 的配额使用情况

### Q: 如何验证 API Key 是否生效

```bash
# 测试 1: 检查配置
cat ~/.gemini/settings.json
cat .env

# 测试 2: 简单查询
export GEMINI_API_KEY="your-key"
npx @google/gemini-cli -p "test" --output-format text

# 测试 3: 运行功能测试
node test_without_api.js
```

---

## 📊 API 使用建议

### 配额管理

- Gemini API 有免费配额限制
- 建议控制抓取频率
- 使用 `--max` 参数限制结果数量

### 最佳实践

```bash
# 小批量测试
node scraper.js search "关键词" --max=5

# 分批处理大数据
node scraper.js batch urls.txt  # 自动控制频率

# 使用缓存（避免重复请求）
# 数据会保存在 ./data/ 目录
```

---

## 🔗 相关资源

- [Gemini API 文档](https://ai.google.dev/docs)
- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Google AI Studio](https://aistudio.google.com)

---

**状态**: ✅ 已配置  
**位置**: `~/.gemini/settings.json` & `.env`  
**测试**: 运行 `node test_without_api.js` 查看状态
