import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

const imageData = fs.readFileSync('/tmp/weibo-login.png');
const base64Image = imageData.toString('base64');

console.log('🔍 正在分析微博截图...\n');

const response = await anthropic.messages.create({
  model: 'pa/claude-sonnet-4-5-20250929',
  max_tokens: 1500,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64Image
        }
      },
      {
        type: 'text',
        text: `这是微博首页截图。请提取页面中所有可见的微博内容，以JSON格式输出：
[
  {
    "author": "作者名",
    "content": "微博内容摘要（前50字）",
    "has_image": true/false,
    "has_video": true/false
  }
]

只提取能清晰看到的微博，最多5条。`
      }
    ]
  }]
});

console.log('✅ 提取结果：\n');
console.log(response.content[0].text);
