# Cookie 导入使用指南

## 🎯 目标

让 browse 能够使用你的真实浏览器登录状态，从而抓取需要登录的平台（微博、小红书、抖音）。

---

## 🚀 方案 A：使用 connect-chrome（推荐）⭐

**最简单的方法！** 直接连接你的真实 Chrome 浏览器，自动共享登录状态。

### 步骤：

1. **启动 connect-chrome**
   ```bash
   # 在 Claude Code 中运行
   /connect-chrome
   ```
   
   这会：
   - 打开一个新的 Chrome 窗口
   - 自动加载你的登录状态和 Cookie
   - browse 可以直接使用这个浏览器

2. **在 Chrome 中登录**
   - 如果你还没登录微博/小红书/抖音，现在登录
   - 登录后保持 Chrome 窗口打开

3. **运行视觉抓取**
   ```bash
   # 访问 http://localhost:8080
   # 选择"视觉抓取"
   # 现在就能抓取需要登录的内容了！
   ```

**优点：**
- ✅ 零配置，一键启动
- ✅ 自动同步登录状态
- ✅ 支持所有 Cookie（包括 HttpOnly）
- ✅ 可以手动完成验证码

---

## 🔧 方案 B：手动导入 Cookie

如果不想打开真实浏览器，可以手动导入 Cookie。

### 步骤：

1. **从 Chrome 导入 Cookie**
   ```bash
   node cookie-importer.js import weibo       # 导入微博 Cookie
   node cookie-importer.js import xiaohongshu # 导入小红书 Cookie
   node cookie-importer.js import douyin      # 导入抖音 Cookie
   ```

2. **验证导入是否成功**
   ```bash
   node cookie-importer.js verify weibo
   ```
   会生成一个截图，检查是否显示登录状态

3. **运行视觉抓取**
   - 访问 http://localhost:8080
   - 选择对应的平台
   - 开始抓取

**限制：**
- ⚠️ HttpOnly Cookie 无法通过 JavaScript 注入
- ⚠️ 需要手动更新 Cookie（登录状态过期后）

---

## 📋 方案对比

| 方案 | 难度 | Cookie 覆盖率 | 自动更新 | 推荐度 |
|------|------|--------------|---------|--------|
| connect-chrome | ⭐ 简单 | 100% | ✅ 是 | ⭐⭐⭐⭐⭐ |
| 手动导入 | ⭐⭐ 中等 | ~70% | ❌ 否 | ⭐⭐⭐ |

---

## 🐛 常见问题

### Q1: connect-chrome 启动失败？
**A:** 检查是否安装了 gstack：
```bash
npm install -g @gstack/cli
# 或
~/.claude/skills/gstack/browse/dist/browse status
```

### Q2: 导入的 Cookie 不生效？
**A:** 可能原因：
1. Cookie 已过期（重新登录 Chrome）
2. HttpOnly Cookie 无法注入（使用 connect-chrome）
3. 平台检测到自动化（使用真实浏览器）

### Q3: 微博/抖音还是跳转登录页？
**A:** 解决方案：
1. 使用 **connect-chrome** 方案（推荐）
2. 检查 Chrome 中是否真的登录了
3. 尝试手动访问一次目标网站，完成人机验证

### Q4: 如何更新 Cookie？
**A:** 两种方式：
- **connect-chrome**: 自动同步，无需手动更新
- **手动导入**: 重新运行 `node cookie-importer.js import <platform>`

---

## 💡 最佳实践

### 推荐工作流程

```bash
# 1. 启动 connect-chrome（一劳永逸）
/connect-chrome

# 2. 在打开的 Chrome 中登录所有平台
# - 微博: weibo.com
# - 小红书: xiaohongshu.com
# - 抖音: douyin.com

# 3. 启动数据抓取平台
node platform-server.js

# 4. 访问 Web 界面
# http://localhost:8080

# 5. 选择"视觉抓取"，开始抓取！
```

### 注意事项

1. **保持 connect-chrome 窗口打开**
   - 关闭窗口会断开连接
   - 需要重新运行 /connect-chrome

2. **定期检查登录状态**
   - 平台 Cookie 可能过期
   - 定期重新登录

3. **遇到验证码时**
   - connect-chrome 允许你手动完成
   - 完成后继续抓取

---

## 🎯 快速开始（推荐）

```bash
# 一条命令搞定所有！
/connect-chrome

# 然后在打开的 Chrome 中登录你需要的平台
# 完成后就可以正常使用视觉抓取了
```

**就这么简单！** ✨
