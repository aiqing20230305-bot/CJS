# V3.1.0 更新日志 - 多指标趋势对比

**发布日期**: 2026-04-06  
**版本代号**: Multi-Metric Comparison

---

## 🎯 核心功能

### 多指标趋势对比

从"单一指标"到"多维度对比"，让用户同时看到数据包数量和文件大小两条趋势线，全面了解数据采集情况。

**使用场景**：
- 同时查看数量和大小趋势
- 发现数据包大小异常（单个包过大）
- 对比分析：数量增长但大小不增长（小文件多）
- 灵活切换：显示/隐藏任一指标

---

## ✨ 新增功能

### 1. 双Y轴Canvas图表

**功能**:
- 左Y轴：数据包数量（蓝色，#2383e2）
- 右Y轴：文件大小（绿色，#10b981，MB单位）
- 两条独立折线（独立缩放）
- 两套坐标系（独立最大值计算）

**技术实现**:
```javascript
// 计算两个Y轴的最大值
const maxCount = Math.max(...data.map(d => d.count), 1);
const maxSize = Math.max(...data.map(d => d.totalSize), 1);
const countAxisMax = Math.ceil(maxCount * 1.1);
const sizeAxisMax = maxSize * 1.1;

// 左Y轴标签（蓝色）
ctx.fillStyle = '#2383e2';
ctx.textAlign = 'right';
ctx.fillText(countValue, padding.left - 10, y + 4);

// 右Y轴标签（绿色）
ctx.fillStyle = '#10b981';
ctx.textAlign = 'left';
ctx.fillText(formatBytes(sizeValue), padding.left + chartWidth + 10, y + 4);
```

**视觉设计**:
- 蓝色折线 + 蓝色渐变填充（数量）
- 绿色折线 + 绿色渐变填充（大小）
- 填充透明度：15%（降低了5%避免两个填充重叠过深）
- 左右padding增加到60px（容纳两侧坐标轴）

---

### 2. 指标切换器

**功能**:
- 两个checkbox（数据包数量、文件大小）
- 默认两个都选中
- 点击切换显示/隐藏对应折线
- 颜色方块图例（蓝色、绿色）

**技术实现**:
```javascript
let showCountMetric = true;
let showSizeMetric = true;

function toggleMetric(metricType) {
  if (metricType === 'count') {
    showCountMetric = document.getElementById('showCountCheckbox').checked;
  } else if (metricType === 'size') {
    showSizeMetric = document.getElementById('showSizeCheckbox').checked;
  }
  updateTrendChart();
}
```

**HTML结构**:
```html
<label class="metric-checkbox">
  <input type="checkbox" id="showCountCheckbox" checked onchange="toggleMetric('count')">
  <span class="metric-label" style="color: #2383e2;">
    <span class="metric-color" style="background: #2383e2;"></span>
    数据包数量
  </span>
</label>
```

---

### 3. 增强的Tooltip

**功能**:
- 同时显示两个指标数据
- 多行显示（换行）
- 颜色区分（蓝色、绿色）
- 智能触发（检测两条线）

**技术实现**:
```javascript
let tooltipHTML = `<div style="font-weight: 600; margin-bottom: 4px;">${closestPoint.date}</div>`;
if (showCountMetric) {
  tooltipHTML += `<div style="color: #2383e2;">📦 ${closestPoint.count}个数据包</div>`;
}
if (showSizeMetric) {
  tooltipHTML += `<div style="color: #10b981;">💾 ${formatBytes(closestPoint.totalSize)}</div>`;
}
tooltip.innerHTML = tooltipHTML;
```

**交互优化**:
- 检测两条线的距离（取最近的）
- 悬停任一折线都能触发tooltip
- 自动显示当前可见的指标

---

### 4. 数据格式化函数

**功能**:
- `parseSizeToBytes()` - 解析大小字符串为字节数
- `formatBytes()` - 格式化字节数为可读字符串

**技术实现**:
```javascript
function parseSizeToBytes(sizeStr) {
  const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024, 'B': 1 };
  const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
  if (!match) return 0;
  return parseFloat(match[1]) * (units[match[2]] || 1);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
```

---

## 🧪 测试用例

### 新增测试（Test 19，16个测试项）

**测试项**:
- ✅ 指标选择器存在
- ✅ 数量指标checkbox存在
- ✅ 大小指标checkbox存在
- ✅ 指标checkbox样式存在
- ✅ 指标标签样式存在
- ✅ 指标颜色方块存在
- ✅ 数量指标标签存在
- ✅ 大小指标标签存在
- ✅ toggleMetric 函数存在
- ✅ parseSizeToBytes 函数存在
- ✅ formatBytes 函数存在
- ✅ showCountMetric 状态变量存在
- ✅ showSizeMetric 状态变量存在
- ✅ 指标选择器样式存在
- ✅ 指标checkbox样式存在

**测试结果**: 210/210 通过 ✅（从194个增加到210个，新增16个）

---

## 📊 使用示例

### 场景1：同时查看数量和大小

**操作**:
1. 页面加载自动显示双指标趋势图
2. 蓝色折线：数据包数量
3. 绿色折线：文件大小
4. 悬停查看详细数据

**显示效果**:
```
📈 数据趋势分析     显示指标：☑ 数据包数量  ☑ 文件大小     时间范围：[7天] [30天]

左轴(数量)                                   右轴(大小)
  10 ┤     ●(蓝)                              2.0MB
     │    ╱ ╲     ●(绿)                        
   5 ┤   ●   ●    ╱ ╲                         1.0MB
     │  ╱     ╲  ●   ●                         
   0 ┼─●───────●─────●                        0MB
     4/1  4/3  4/5  4/7
     
Tooltip: 2026-04-05
         📦 12个数据包
         💾 1.85 MB
```

---

### 场景2：只查看数量趋势

**操作**:
1. 取消勾选"文件大小"checkbox
2. 图表只显示蓝色折线
3. 右Y轴隐藏
4. Tooltip只显示数量

**效果**: 聚焦单一指标，更清晰

---

### 场景3：发现大小异常

**观察**:
- 数量增长：12 → 15个数据包（+25%）
- 大小增长：1.5MB → 3.2MB（+113%）

**分析**: 单个文件平均大小增长，可能需要检查数据质量

---

## 🎨 UI/UX 改进

### 视觉设计

**新增内容**:
- 双Y轴坐标系（左蓝右绿）
- 指标切换器（checkbox + 颜色图例）
- 两条折线（蓝色数量、绿色大小）
- 多行tooltip（分行显示指标）

**设计原则**:
- 颜色语义：蓝色（数量）、绿色（大小）
- 图例清晰：颜色方块 + 文字标注
- 独立缩放：两个Y轴独立最大值
- 响应式：根据显示状态调整布局

---

### 交互体验

**改进点**:
- 灵活切换：checkbox控制显示/隐藏
- 智能tooltip：自动显示可见指标
- 双线触发：悬停任一折线都能触发
- 即时反馈：切换指标立即重绘

---

## 📈 版本对比

| 功能 | V3.0.0 | V3.1.0 |
|------|--------|--------|
| 趋势线数量 | 1条（数量） | 2条（数量+大小） |
| Y轴 | 单Y轴 | 双Y轴（左右独立） |
| 指标切换 | 无 | 有（checkbox控制） |
| Tooltip | 单指标 | 多指标（分行显示） |
| 颜色方案 | 蓝色 | 蓝色+绿色 |

---

## 🎉 用户价值

### 多维度对比

**问题**: 只能看数量，无法了解文件大小

**解决**:
- 同时看数量和大小趋势
- 双Y轴独立缩放
- 对比两个指标关系

**效果**: 全面了解数据采集情况

---

### 异常发现

**问题**: 数据包大小异常不容易发现

**解决**:
- 绿色折线显示大小趋势
- 大小突增立即可见
- 对比分析：数量vs大小

**效果**: 及时发现数据质量问题

---

### 灵活分析

**问题**: 两条线可能重叠难以观察

**解决**:
- checkbox切换显示/隐藏
- 聚焦单一指标分析
- 根据需要自由组合

**效果**: 适应不同分析场景

---

## 🔄 迭代历史

- **V2.0.0**: 基础平台（SSE进度、ZIP下载）
- **V2.1.0**: JSON在线预览
- **V2.2.0**: 数据统计面板
- **V2.3.0**: 类型分布饼图
- **V2.4.0**: 单文件Excel导出
- **V2.5.0**: 批量Excel导出（多Sheet）
- **V2.6.0**: 数据筛选与搜索
- **V2.7.0**: 批量操作与文件管理
- **V2.8.0**: 筛选条件持久化与预设
- **V2.9.0**: 数据趋势统计增强
- **V3.0.0**: Canvas趋势图表可视化
- **V3.1.0**: 多指标趋势对比 ← 当前版本

---

## 📦 文件变更

### 修改的文件

1. **scraper-platform.html**
   - 新增CSS样式（40行）：指标选择器、颜色方块
   - 新增HTML结构（25行）：指标checkbox、图例
   - 新增JavaScript函数（30行）：toggleMetric、parseSizeToBytes、formatBytes
   - 修改drawTrendChart函数（+100行）：双Y轴绘制逻辑
   - 修改setupCanvasInteraction函数（+30行）：多指标tooltip
   - 修改padding：left/right 50 → 60（容纳双Y轴）

2. **test_platform.js**
   - 新增Test 19：多指标对比UI测试（16项）
   - 总测试数：194 → 210（+16）

3. **package.json**
   - 版本号更新：3.0.0 → 3.1.0

---

## 🚀 下一步计划

### 短期优化（V3.2.0候选）
- [ ] 图表类型切换（折线图/柱状图/面积图）
- [ ] 数据导出功能（导出图表为PNG）
- [ ] 时间范围自定义（选择任意日期区间）
- [ ] 数据点标注（最大值/最小值高亮）

### 中期规划（V3.3.0+）
- [ ] 数据类型分布趋势（按类型分组折线）
- [ ] 趋势洞察提示（自动分析文案）
- [ ] 数据对比模式（本周 vs 上周叠加）
- [ ] Y轴缩放控制（手动调整范围）

### 长期愿景（V3.5+）
- [ ] 实时数据流（WebSocket更新）
- [ ] 预测性分析（基于历史趋势预测）
- [ ] 多维度钻取（按类型、品牌分组）
- [ ] 自定义指标（用户定义计算公式）

---

## 💡 设计思考

### 为什么选择双Y轴而不是归一化？

**原因**:
- 数量和大小的量纲不同（个 vs 字节）
- 双Y轴保留原始数值的意义
- 用户更容易理解实际数值

**权衡**: 双Y轴可能增加认知负担，但更符合用户预期

---

### 为什么使用颜色区分而不是线条样式？

**原因**:
- 颜色区分更直观（蓝vs绿）
- 与Y轴标签颜色一致
- 线条样式（实线vs虚线）不够清晰

**优势**: 视觉识别速度更快

---

### 为什么填充透明度降低到15%？

**原因**:
- 两个填充可能重叠
- 20% + 20% = 40%过深
- 15%更柔和，重叠时仍可见

**效果**: 视觉平衡，不抢夺折线注意力

---

### 为什么默认两个指标都选中？

**原因**:
- 用户首次看到完整功能
- 展示平台的多维度分析能力
- 用户可以根据需要隐藏

**权衡**: 可能增加初始视觉复杂度，但展示了产品核心价值

---

## 📐 技术细节

### 双Y轴坐标映射

**问题**: 如何计算两个Y轴的坐标映射？

**方案**:
```javascript
// 数量Y轴映射（左）
const countY = padding.top + chartHeight - (d.count / countAxisMax) * chartHeight;

// 大小Y轴映射（右）
const sizeY = padding.top + chartHeight - (d.totalSize / sizeAxisMax) * chartHeight;
```

**关键**: 两个Y轴独立计算最大值，独立缩放

---

### Tooltip距离计算

**问题**: 如何判断鼠标接近哪条线？

**方案**:
```javascript
// 分别计算到两条线的距离
const distanceCount = Math.sqrt(
  Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.countY, 2)
);
const distanceSize = Math.sqrt(
  Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.sizeY, 2)
);

// 取最小距离
if (distanceCount < minDistance && distanceCount < 20) {
  minDistance = distanceCount;
  closestPoint = point;
}
```

**效果**: 悬停任一折线都能触发tooltip

---

### 数据聚合复用

**优势**: 复用V2.9.0的aggregateByDay函数，已包含totalSize字段

**代码**:
```javascript
dayMap[dayKey].totalSize += parseSizeToBytes(file.size);
```

**收益**: 无需修改数据聚合逻辑，直接使用现有数据

---

## 🐛 已知问题

### 1. 两条线重叠时难以区分

**问题**: 当数量和大小趋势相似时，两条线可能重叠

**临时方案**: 使用指标切换器隐藏其中一条

**长期解决**: 添加线条样式区分（实线+虚线）

---

### 2. Y轴标签可能重叠

**问题**: 左右Y轴标签数值过长时可能重叠

**临时方案**: 增加左右padding到60px

**长期解决**: 自适应padding（根据标签长度计算）

---

## 🎯 性能优化

### 1. 条件渲染

**优化**: 只绘制选中的指标

**代码**:
```javascript
if (showCountMetric) {
  // 绘制数量折线
}
if (showSizeMetric) {
  // 绘制大小折线
}
```

**收益**: 减少50%绘制操作（单指标时）

---

### 2. 数据缓存

**现状**: trendChartData包含两个Y坐标

**代码**:
```javascript
trendChartData = data.map((d, i) => {
  return { ...d, x, countY, sizeY };
});
```

**收益**: 避免tooltip时重复计算坐标

---

**V3.1.0 开发完成时间**: 2026-04-06  
**测试通过率**: 100% (210/210)  
**生产就绪状态**: ✅ Ready
