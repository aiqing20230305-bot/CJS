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

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8080;

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

        const envPrefix = apiKey ? `GEMINI_API_KEY="${apiKey}"` : '';

        switch (scrapeType) {
          case 'market':
            command = `${envPrefix} node integrations/super-insight.js market "${brand}" "${category}"`;
            break;
          case 'videos':
            command = `${envPrefix} node integrations/super-insight.js videos "${brand} ${category}"`;
            break;
          case 'competitors':
            command = `${envPrefix} node integrations/super-insight.js competitors "${competitors.join(',')}" "${category}"`;
            break;
          case 'report':
            command = `${envPrefix} node scraper.js trends "${category}" --days=${days}`;
            break;
          case 'full':
            command = `${envPrefix} node integrations/super-insight.js full --brand="${brand}" --category="${category}" --competitors="${competitors.join(',')}"`;
            break;
          default:
            throw new Error('Unknown scrape type');
        }

        console.log('执行命令:', command);

        // Execute in background
        const childProcess = exec(command, { cwd: __dirname });
        const taskId = Date.now().toString();

        // Send immediate response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          taskId,
          message: '抓取任务已启动'
        }));

        // Handle process output
        childProcess.stdout.on('data', data => {
          console.log('stdout:', data.toString());
        });

        childProcess.stderr.on('data', data => {
          console.error('stderr:', data.toString());
        });

        childProcess.on('close', code => {
          console.log(`任务完成，退出码: ${code}`);
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

  // API: Download file
  if (url.pathname.startsWith('/api/download/') && req.method === 'GET') {
    try {
      const filename = url.pathname.replace('/api/download/', '');
      const filepath = path.join(__dirname, 'data', filename);

      const content = await fs.readFile(filepath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      res.end(content);
    } catch (error) {
      res.writeHead(404);
      res.end('File not found');
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
