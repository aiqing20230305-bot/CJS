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
