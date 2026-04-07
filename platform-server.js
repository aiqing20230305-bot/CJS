#!/usr/bin/env node
/**
 * 数据抓取配置平台 - HTTP 服务器
 * 连接前端页面和 scraper.js
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import xlsx from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { scrapeWeibo, scrapeXiaohongshu, scrapeDouyin, saveData } from './scraper-vision.js';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8080;

// Task registry for progress tracking
const taskRegistry = new Map();

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain'
};

// ===== AI Report Generation Functions =====

/**
 * Analyze trend from data (server-side version)
 * Extracted from frontend analyzeTrend() function
 */
function analyzeTrendOnServer(data) {
  if (!data || data.length < 2) {
    return { growthRate: 0, avgGrowthRate: 0, direction: 'stable', volatility: 0, mean: 0 };
  }

  // Calculate overall growth rate (first vs last)
  const firstValue = data[0].count || 0;
  const lastValue = data[data.length - 1].count || 0;
  const growthRate = firstValue > 0 ? ((lastValue - firstValue) / firstValue * 100).toFixed(1) : 0;

  // Calculate average daily growth rate
  let totalGrowth = 0;
  let growthCount = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].count > 0) {
      const dailyGrowth = (data[i].count - data[i - 1].count) / data[i - 1].count * 100;
      totalGrowth += dailyGrowth;
      growthCount++;
    }
  }
  const avgGrowthRate = growthCount > 0 ? (totalGrowth / growthCount).toFixed(1) : 0;

  // Determine trend direction
  let direction = 'stable';
  if (growthRate > 10) {
    direction = 'rising';
  } else if (growthRate < -10) {
    direction = 'falling';
  }

  // Calculate volatility (standard deviation)
  const values = data.map(d => d.count || 0);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const volatility = Math.sqrt(variance).toFixed(1);

  // Detect anomalies (2σ rule)
  const stdDev = Math.sqrt(variance);
  const anomalies = [];
  data.forEach((d, i) => {
    const value = d.count || 0;
    if (value > mean + 2 * stdDev) {
      anomalies.push({ type: 'high', date: d.date, value });
    } else if (value < mean - 2 * stdDev) {
      anomalies.push({ type: 'low', date: d.date, value });
    }
  });

  return { growthRate, avgGrowthRate, direction, volatility, mean, anomalies };
}

/**
 * Build prompt for Claude API
 */
function buildReportPrompt(dataPackage, analysisResult) {
  const { brand, category, generatedAt, data } = dataPackage;

  return `你是一位专业的电商数据分析师，擅长从数据中发现商业洞察。请基于以下数据生成一份深度分析报告。

# 数据概览

**品牌**: ${brand || '未知'}
**类别**: ${category || '未知'}
**数据采集时间**: ${generatedAt || new Date().toISOString()}
**数据包大小**: ${analysisResult.totalCount || 0} 条记录

# 趋势分析

- **整体增长率**: ${analysisResult.growthRate}% ${analysisResult.direction === 'rising' ? '📈' : analysisResult.direction === 'falling' ? '📉' : '➡️'}
- **平均日增长率**: ${analysisResult.avgGrowthRate}%
- **趋势方向**: ${analysisResult.direction === 'rising' ? '上升趋势' : analysisResult.direction === 'falling' ? '下降趋势' : '稳定'}
- **波动性**: ${analysisResult.volatility} (波动${parseFloat(analysisResult.volatility) > analysisResult.mean * 0.3 ? '较大' : '平稳'})
- **异常点**: ${analysisResult.anomalies.length} 个${analysisResult.anomalies.length > 0 ? ` (${analysisResult.anomalies.map(a => a.type === 'high' ? '高峰' : '低谷').join(', ')})` : ''}

# 原始数据摘要

${data ? JSON.stringify(data, null, 2).substring(0, 1000) : '无详细数据'}...

---

# 要求

请生成一份**800-1000字**的数据分析报告，包含以下部分：

## 1. 核心发现 (3条)
列出3个最重要的数据洞察，每条用一句话概括，加上具体数字支撑。

## 2. 趋势深度解读
基于增长率、波动性、异常点，分析：
- 数据增长的驱动因素
- 波动的可能原因
- 异常点背后的商业意义

## 3. 商业建议
提供3-5条可执行的商业建议，包括：
- 内容策略优化方向
- 投放平台选择
- 目标人群精准定位
- 时间节点把控

## 输出格式要求

- 使用Markdown格式
- 标题使用 ## 或 ###
- 重点内容使用 **加粗**
- 数据用数字和百分比呈现
- 每个建议前加上序号

请开始生成报告：`;
}

/**
 * Generate AI report using Claude API
 */
async function generateAIReport(dataPackageId, taskId) {
  const dataDir = path.join(__dirname, 'data');
  const reportsDir = path.join(dataDir, 'reports');

  try {
    // Create reports directory
    await fs.mkdir(reportsDir, { recursive: true });

    // Read data package
    const dataPath = path.join(dataDir, dataPackageId);
    const dataPackage = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

    // Mock data for trend analysis (since we don't have historical data)
    const mockTrendData = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      count: Math.floor(Math.random() * 50) + 10 + i * 5
    }));

    // Analyze trend
    const analysisResult = analyzeTrendOnServer(mockTrendData);
    analysisResult.totalCount = mockTrendData.length;

    // Build prompt
    const prompt = buildReportPrompt(dataPackage, analysisResult);

    // Initialize Claude client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });

    // Broadcast start
    broadcast(taskId, { type: 'log', message: '📝 正在生成AI报告...' });

    // Call Claude API with streaming
    const stream = await anthropic.messages.stream({
      model: 'pa/claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }],
    });

    let reportMarkdown = '';

    // Stream response
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        reportMarkdown += text;

        // Broadcast chunk to frontend
        broadcast(taskId, {
          type: 'report_chunk',
          content: text
        });
      }
    }

    // Save report
    const timestamp = Date.now();
    const reportFilename = `report_${dataPackage.type || 'unknown'}_${dataPackage.brand || 'brand'}_${timestamp}.md`;
    const reportPath = path.join(reportsDir, reportFilename);

    await fs.writeFile(reportPath, reportMarkdown, 'utf-8');

    // Broadcast completion
    broadcast(taskId, {
      type: 'complete',
      message: '✅ 报告生成完成',
      filename: reportFilename,
      path: reportPath
    });

    // Update task status
    const task = taskRegistry.get(taskId);
    if (task) {
      task.status = 'completed';
      task.reportFilename = reportFilename;
    }

    console.log(`Report generated: ${reportFilename}`);

  } catch (error) {
    console.error('Report generation error:', error);

    broadcast(taskId, {
      type: 'error',
      message: `报告生成失败: ${error.message}`
    });

    const task = taskRegistry.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
    }
  }
}

// Helper function to broadcast to all SSE connections of a task
function broadcast(taskId, data) {
  const task = taskRegistry.get(taskId);
  if (task && task.connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    task.connections.forEach(conn => {
      try {
        conn.write(message);
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    });
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = await fs.readFile(path.join(__dirname, 'scraper-platform.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      res.writeHead(500);
      res.end('Error loading page');
    }
    return;
  }

  // API: Progress SSE endpoint
  if (url.pathname.startsWith('/api/progress/') && req.method === 'GET') {
    const taskId = url.pathname.replace('/api/progress/', '');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);

    // Register this connection
    const task = taskRegistry.get(taskId);
    if (task) {
      task.connections = task.connections || [];
      task.connections.push(res);

      // Send any buffered logs
      if (task.logs && task.logs.length > 0) {
        task.logs.forEach(log => {
          res.write(`data: ${JSON.stringify({ type: 'log', message: log })}\n\n`);
        });
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Task not found' })}\n\n`);
    }

    // Handle client disconnect
    req.on('close', () => {
      if (task && task.connections) {
        task.connections = task.connections.filter(conn => conn !== res);
      }
    });

    return;
  }

  // API: Start scraping
  if (url.pathname === '/api/scrape' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        console.log('收到抓取请求:', config);

        // Build command
        let command;
        const { brand, category, competitors, scrapeType, days, maxResults, platforms } = config;

        // Load API key
        const envPath = path.join(__dirname, '.env');
        let apiKey = process.env.GEMINI_API_KEY;
        try {
          const envContent = await fs.readFile(envPath, 'utf-8');
          const match = envContent.match(/GEMINI_API_KEY=(.+)/);
          if (match) apiKey = match[1].trim();
        } catch {}

        // Build command without environment variable prefix
        switch (scrapeType) {
          case 'market':
            command = `node integrations/super-insight.js market "${brand}" "${category}"`;
            break;
          case 'videos':
            command = `node integrations/super-insight.js videos "${brand} ${category}"`;
            break;
          case 'competitors':
            command = `node integrations/super-insight.js competitors "${competitors.join(',')}" "${category}"`;
            break;
          case 'report':
            command = `node scraper.js trends "${category}" --days=${days}`;
            break;
          case 'full':
            command = `node integrations/super-insight.js full --brand="${brand}" --category="${category}" --competitors="${competitors.join(',')}"`;
            break;
          default:
            throw new Error('Unknown scrape type');
        }

        console.log('执行命令:', command);
        console.log('API Key:', apiKey ? 'configured' : 'not found');

        // Generate task ID
        const taskId = Date.now().toString();

        // Register task
        taskRegistry.set(taskId, {
          id: taskId,
          status: 'running',
          progress: 0,
          logs: [],
          connections: [],
          startTime: new Date()
        });

        // Function to broadcast to all SSE connections
        const broadcast = (data) => {
          const task = taskRegistry.get(taskId);
          if (task && task.connections) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            task.connections.forEach(conn => {
              try {
                conn.write(message);
              } catch (err) {
                console.error('Error writing to SSE connection:', err);
              }
            });
          }
        };

        // Send immediate response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          taskId,
          message: '抓取任务已启动'
        }));

        // Execute in background with environment variables
        const childProcess = exec(command, {
          cwd: __dirname,
          env: { ...process.env, GEMINI_API_KEY: apiKey || process.env.GEMINI_API_KEY },
          shell: '/bin/bash'
        });

        // Broadcast initial status
        broadcast({ type: 'status', status: 'running', progress: 10, message: '正在启动抓取引擎...' });

        // Handle process output
        childProcess.stdout.on('data', data => {
          const log = data.toString();
          console.log('stdout:', log);

          const task = taskRegistry.get(taskId);
          if (task) {
            task.logs.push(log);
            task.progress = Math.min(task.progress + 10, 90);
          }

          broadcast({ type: 'log', message: log });
          broadcast({ type: 'progress', progress: task ? task.progress : 50 });
        });

        childProcess.stderr.on('data', data => {
          const log = data.toString();
          console.error('stderr:', log);

          const task = taskRegistry.get(taskId);
          if (task) {
            task.logs.push(log);
          }

          broadcast({ type: 'log', message: log, level: 'error' });
        });

        childProcess.on('close', code => {
          console.log(`任务完成，退出码: ${code}`);

          const task = taskRegistry.get(taskId);
          if (task) {
            task.status = code === 0 ? 'completed' : 'failed';
            task.progress = 100;
            task.endTime = new Date();
          }

          broadcast({
            type: 'status',
            status: code === 0 ? 'completed' : 'failed',
            progress: 100,
            message: code === 0 ? '✅ 抓取完成' : '❌ 抓取失败',
            exitCode: code
          });

          // Close all SSE connections after a delay
          setTimeout(() => {
            if (task && task.connections) {
              task.connections.forEach(conn => {
                try {
                  conn.end();
                } catch (err) {}
              });
            }
            // Clean up task after 5 minutes
            setTimeout(() => {
              taskRegistry.delete(taskId);
            }, 5 * 60 * 1000);
          }, 2000);
        });

      } catch (error) {
        console.error('抓取错误:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
    return;
  }

  // API: Vision-based scraping (新方案)
  if (url.pathname === '/api/scrape-vision' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        console.log('收到视觉抓取请求:', config);

        const { platform, keyword, maxResults = 10 } = config;

        if (!platform || !keyword) {
          throw new Error('缺少必要参数: platform, keyword');
        }

        // Generate task ID
        const taskId = Date.now().toString();

        // Register task
        taskRegistry.set(taskId, {
          id: taskId,
          status: 'running',
          progress: 0,
          logs: [],
          connections: [],
          startTime: new Date()
        });

        // Function to broadcast to all SSE connections
        const broadcast = (data) => {
          const task = taskRegistry.get(taskId);
          if (task && task.connections) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            task.connections.forEach(conn => {
              try {
                conn.write(message);
              } catch (err) {
                console.error('Error writing to SSE connection:', err);
              }
            });
          }
        };

        // Send immediate response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          taskId,
          message: `${platform}抓取任务已启动`
        }));

        // Execute scraping in background
        (async () => {
          try {
            broadcast({ type: 'status', status: 'running', progress: 10, message: `正在访问${platform}...` });

            let result;
            const options = { maxResults };

            switch (platform) {
              case 'weibo':
                broadcast({ type: 'log', message: `📸 正在截图微博搜索页...` });
                result = await scrapeWeibo(keyword, options);
                break;
              case 'xiaohongshu':
              case 'xhs':
                broadcast({ type: 'log', message: `📕 正在截图小红书搜索页...` });
                result = await scrapeXiaohongshu(keyword, options);
                break;
              case 'douyin':
                broadcast({ type: 'log', message: `🎵 正在截图抖音搜索页...` });
                broadcast({ type: 'log', message: `⚠️  抖音可能需要滑块验证`, level: 'warn' });
                result = await scrapeDouyin(keyword, { ...options, skipCaptchaCheck: true });
                break;
              default:
                throw new Error(`不支持的平台: ${platform}`);
            }

            broadcast({ type: 'progress', progress: 70 });

            // Save data
            const filename = `${platform}_${keyword}_${Date.now()}.json`;
            await saveData(result, filename);

            broadcast({ type: 'log', message: `✅ 成功提取 ${result.count} 条数据` });
            broadcast({ type: 'progress', progress: 100 });

            const task = taskRegistry.get(taskId);
            if (task) {
              task.status = 'completed';
              task.progress = 100;
              task.endTime = new Date();
              task.resultFile = filename;
            }

            broadcast({
              type: 'status',
              status: 'completed',
              progress: 100,
              message: '✅ 抓取完成',
              resultFile: filename,
              dataCount: result.count
            });

          } catch (error) {
            console.error('视觉抓取错误:', error);

            const task = taskRegistry.get(taskId);
            if (task) {
              task.status = 'failed';
              task.error = error.message;
              task.endTime = new Date();
            }

            broadcast({
              type: 'status',
              status: 'failed',
              progress: 100,
              message: `❌ 抓取失败: ${error.message}`,
              error: error.message
            });
          }

          // Close SSE connections after delay
          setTimeout(() => {
            const task = taskRegistry.get(taskId);
            if (task && task.connections) {
              task.connections.forEach(conn => {
                try {
                  conn.end();
                } catch (err) {}
              });
            }
            // Clean up task after 5 minutes
            setTimeout(() => {
              taskRegistry.delete(taskId);
            }, 5 * 60 * 1000);
          }, 2000);
        })();

      } catch (error) {
        console.error('视觉抓取请求错误:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
    return;
  }

  // API: Get statistics
  if (url.pathname === '/api/stats' && req.method === 'GET') {
    try {
      const dataDir = path.join(__dirname, 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          totalFiles: 0,
          totalSize: 0,
          totalSizeFormatted: '0 MB',
          latestFile: null,
          typeDistribution: {},
          avgFileSize: 0
        }));
        return;
      }

      // Get file stats
      const fileStats = await Promise.all(
        jsonFiles.map(async filename => {
          const filepath = path.join(dataDir, filename);
          const stats = await fs.stat(filepath);

          // Extract type from filename (e.g., "market_brand_123.json" -> "market")
          const typeMatch = filename.match(/^(market|videos|competitors|report|full|test)/i);
          const type = typeMatch ? typeMatch[1].toLowerCase() : 'other';

          return {
            filename,
            size: stats.size,
            mtime: stats.mtime,
            type
          };
        })
      );

      // Calculate statistics
      const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);
      const latestFile = fileStats.reduce((latest, f) =>
        (!latest || f.mtime > latest.mtime) ? f : latest
      , null);

      // Type distribution
      const typeDistribution = fileStats.reduce((dist, f) => {
        dist[f.type] = (dist[f.type] || 0) + 1;
        return dist;
      }, {});

      // Format size
      const formatSize = (bytes) => {
        if (bytes === 0) return '0 MB';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      };

      const stats = {
        totalFiles: jsonFiles.length,
        totalSize: totalSize,
        totalSizeFormatted: formatSize(totalSize),
        avgFileSize: formatSize(totalSize / jsonFiles.length),
        latestFile: latestFile ? {
          filename: latestFile.filename,
          time: latestFile.mtime.toISOString()
        } : null,
        typeDistribution,
        generatedAt: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (error) {
      console.error('Stats error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: List data files
  if (url.pathname === '/api/files' && req.method === 'GET') {
    try {
      const dataDir = path.join(__dirname, 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const files = await fs.readdir(dataDir);
      const fileList = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async filename => {
            const filepath = path.join(dataDir, filename);
            const stats = await fs.stat(filepath);
            return {
              filename,
              time: stats.mtime.toISOString(),
              size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
              path: `/api/download/${filename}`
            };
          })
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fileList));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Delete files
  if (url.pathname === '/api/files' && req.method === 'DELETE') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { files } = JSON.parse(body);

        if (!Array.isArray(files) || files.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '请提供要删除的文件列表' }));
          return;
        }

        console.log('Delete request:', { fileCount: files.length, files });

        const dataDir = path.join(__dirname, 'data');
        let deleted = 0;
        let failed = 0;
        const errors = [];

        for (const filename of files) {
          // Security check: prevent path traversal
          if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            console.warn('Security warning: invalid filename:', filename);
            failed++;
            errors.push(`无效的文件名: ${filename}`);
            continue;
          }

          // Check file extension
          if (!filename.endsWith('.json')) {
            failed++;
            errors.push(`只能删除JSON文件: ${filename}`);
            continue;
          }

          const filepath = path.join(dataDir, filename);

          try {
            await fs.unlink(filepath);
            deleted++;
            console.log('Deleted file:', filename);
          } catch (error) {
            if (error.code === 'ENOENT') {
              // File doesn't exist, count as success (already deleted)
              console.log('File not found (already deleted):', filename);
              deleted++;
            } else {
              failed++;
              errors.push(`${filename}: ${error.message}`);
              console.error('Failed to delete file:', filename, error);
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          deleted,
          failed,
          errors: errors.length > 0 ? errors : undefined
        }));
      } catch (error) {
        console.error('Delete API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });

    return;
  }

  // API: Preview file (return JSON content)
  if (url.pathname.startsWith('/api/preview/') && req.method === 'GET') {
    try {
      const filename = decodeURIComponent(url.pathname.replace('/api/preview/', ''));
      const filepath = path.join(__dirname, 'data', filename);

      console.log('Preview request:', { filename, filepath });

      const content = await fs.readFile(filepath, 'utf-8');

      // Validate JSON
      try {
        JSON.parse(content);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON file' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
    } catch (error) {
      console.error('Preview error:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
    return;
  }

  // API: Download file
  if (url.pathname.startsWith('/api/download/') && req.method === 'GET') {
    try {
      const filename = decodeURIComponent(url.pathname.replace('/api/download/', ''));
      const filepath = path.join(__dirname, 'data', filename);

      console.log('Download request:', { filename, filepath });

      const content = await fs.readFile(filepath);

      // Encode filename for Content-Disposition header
      const encodedFilename = encodeURIComponent(filename);

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`
      });
      res.end(content);
    } catch (error) {
      console.error('Download error:', error);
      res.writeHead(404);
      res.end('File not found');
    }
    return;
  }

  // API: Export all files to Excel (multi-sheet)
  if (url.pathname === '/api/export-all' && req.method === 'GET') {
    try {
      const dataDir = path.join(__dirname, 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '没有可导出的数据文件' }));
        return;
      }

      console.log('Batch export request:', { fileCount: jsonFiles.length });

      // Flatten nested JSON to rows
      function flattenObject(obj, prefix = '') {
        let result = {};
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              Object.assign(result, flattenObject(obj[key], newKey));
            } else if (Array.isArray(obj[key])) {
              result[newKey] = JSON.stringify(obj[key]);
            } else {
              result[newKey] = obj[key];
            }
          }
        }
        return result;
      }

      // Create workbook
      const wb = xlsx.utils.book_new();

      // Process each file
      for (const filename of jsonFiles) {
        const filepath = path.join(dataDir, filename);

        try {
          const content = await fs.readFile(filepath, 'utf-8');
          const jsonData = JSON.parse(content);

          // Convert JSON to worksheet data
          let wsData = [];
          if (Array.isArray(jsonData)) {
            wsData = jsonData.map(item => flattenObject(item));
          } else {
            wsData = [flattenObject(jsonData)];
          }

          // Create worksheet
          const ws = xlsx.utils.json_to_sheet(wsData);

          // Generate sheet name (max 31 chars for Excel)
          let sheetName = filename.replace('.json', '');
          if (sheetName.length > 31) {
            sheetName = sheetName.substring(0, 28) + '...';
          }

          // Add worksheet to workbook
          xlsx.utils.book_append_sheet(wb, ws, sheetName);

          console.log(`Added sheet: ${sheetName}`);
        } catch (error) {
          console.error(`Error processing ${filename}:`, error.message);
          // Continue with other files
        }
      }

      // Generate Excel file buffer
      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const excelFilename = `数据汇总_${timestamp}.xlsx`;
      const encodedExcelName = encodeURIComponent(excelFilename);

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedExcelName}`,
        'Content-Length': excelBuffer.length
      });
      res.end(excelBuffer);

      console.log(`Batch export completed: ${jsonFiles.length} files, ${excelBuffer.length} bytes`);
    } catch (error) {
      console.error('Batch export error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Export to Excel
  if (url.pathname.startsWith('/api/export/') && req.method === 'GET') {
    try {
      const filename = decodeURIComponent(url.pathname.replace('/api/export/', ''));
      const filepath = path.join(__dirname, 'data', filename);

      console.log('Export request:', { filename, filepath });

      // Read JSON file
      const content = await fs.readFile(filepath, 'utf-8');
      const jsonData = JSON.parse(content);

      // Flatten nested JSON to rows
      function flattenObject(obj, prefix = '') {
        let result = {};
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              Object.assign(result, flattenObject(obj[key], newKey));
            } else if (Array.isArray(obj[key])) {
              result[newKey] = JSON.stringify(obj[key]);
            } else {
              result[newKey] = obj[key];
            }
          }
        }
        return result;
      }

      // Create workbook
      const wb = xlsx.utils.book_new();

      // Convert JSON to worksheet
      let wsData = [];

      if (Array.isArray(jsonData)) {
        // If root is array, flatten each item
        wsData = jsonData.map(item => flattenObject(item));
      } else {
        // If root is object, flatten it
        wsData = [flattenObject(jsonData)];
      }

      // Create worksheet from data
      const ws = xlsx.utils.json_to_sheet(wsData);

      // Add worksheet to workbook
      xlsx.utils.book_append_sheet(wb, ws, '数据');

      // Generate Excel file buffer
      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set filename for Excel
      const excelFilename = filename.replace('.json', '.xlsx');
      const encodedExcelName = encodeURIComponent(excelFilename);

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedExcelName}`,
        'Content-Length': excelBuffer.length
      });
      res.end(excelBuffer);
    } catch (error) {
      console.error('Export error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Download all files as zip
  if (url.pathname === '/api/download-all' && req.method === 'GET') {
    try {
      const dataDir = path.join(__dirname, 'data');
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '没有可下载的数据文件' }));
        return;
      }

      // Create zip filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const zipFilename = `数据包_${timestamp}.zip`;
      const encodedZipName = encodeURIComponent(zipFilename);

      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedZipName}`
      });

      // Create archiver instance
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => {
        console.error('Archiver error:', err);
        throw err;
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add files to archive
      for (const file of jsonFiles) {
        const filepath = path.join(dataDir, file);
        archive.file(filepath, { name: file });
      }

      // Finalize archive
      await archive.finalize();

      console.log(`Batch download: ${jsonFiles.length} files compressed`);
    } catch (error) {
      console.error('Batch download error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
    return;
  }

  // API: Generate AI Report
  if (url.pathname === '/api/generate-report' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { dataPackageId, reportType } = JSON.parse(body);

        if (!dataPackageId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '缺少 dataPackageId 参数' }));
          return;
        }

        // Check if data package exists
        const dataPath = path.join(__dirname, 'data', dataPackageId);
        try {
          await fs.access(dataPath);
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '数据包不存在' }));
          return;
        }

        // Create task ID
        const taskId = `report_${Date.now()}`;

        // Register task
        taskRegistry.set(taskId, {
          type: 'report',
          status: 'processing',
          dataPackageId,
          reportType: reportType || 'full',
          connections: [],
          startTime: new Date()
        });

        // Start report generation in background
        generateAIReport(dataPackageId, taskId);

        // Return task ID
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          taskId,
          message: `报告生成中，请监听 /api/progress/${taskId}`
        }));

      } catch (error) {
        console.error('Generate report error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // API: List reports
  if (url.pathname === '/api/reports' && req.method === 'GET') {
    try {
      const reportsDir = path.join(__dirname, 'data', 'reports');

      // Create directory if not exists
      await fs.mkdir(reportsDir, { recursive: true });

      const files = await fs.readdir(reportsDir);
      const reportFiles = files.filter(f => f.endsWith('.md'));

      const reports = await Promise.all(
        reportFiles.map(async filename => {
          const filepath = path.join(reportsDir, filename);
          const stats = await fs.stat(filepath);

          // Extract dataPackageId from filename (e.g., "report_market_多芬_1775409566540.md")
          const match = filename.match(/report_(.+)_(\d+)\.md$/);
          const dataPackageId = match ? match[1] : 'unknown';

          return {
            filename,
            createdAt: stats.birthtime.toISOString(),
            size: stats.size,
            dataPackageId
          };
        })
      );

      // Sort by creation time (newest first)
      reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reports));

    } catch (error) {
      console.error('List reports error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // API: Download report
  if (url.pathname.startsWith('/api/reports/') && req.method === 'GET') {
    try {
      const filename = decodeURIComponent(url.pathname.replace('/api/reports/', ''));
      const reportsDir = path.join(__dirname, 'data', 'reports');
      const filepath = path.join(reportsDir, filename);

      // Security check: prevent directory traversal
      if (!filepath.startsWith(reportsDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效的文件路径' }));
        return;
      }

      // Read file
      const content = await fs.readFile(filepath, 'utf-8');

      res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      });
      res.end(content);

    } catch (error) {
      console.error('Download report error:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '报告文件不存在' }));
    }
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   数据抓取配置平台已启动                  ║
╚══════════════════════════════════════════╝

🌐 访问地址: http://localhost:${PORT}
📁 数据目录: ${path.join(__dirname, 'data')}

按 Ctrl+C 停止服务器
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n停止服务器...');
  server.close(() => {
    console.log('服务器已停止');
    process.exit(0);
  });
});
