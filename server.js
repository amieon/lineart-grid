import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const MAX_BODY_BYTES = 40 * 1024 * 1024;

const ENV_FILE = process.env.LINEART_ENV_FILE || path.join(ROOT, '.env');
loadEnv(ENV_FILE);

const CONFIG = {
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  model: process.env.QWEN_IMAGE_MODEL || 'qwen-image-edit-plus',
  endpoint:
    process.env.QWEN_IMAGE_ENDPOINT ||
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  promptExtend: String(process.env.QWEN_PROMPT_EXTEND || 'false') === 'true',
  port: Number(process.env.PORT || 5173),
};

function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function persistEnv(updates) {
  let text = '';
  try {
    text = fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    text = '';
  }
  if (text && !text.endsWith('\n')) text += '\n';
  const pending = { ...updates };
  const out = text.split('\n').map((line) => {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (m && pending[m[1]] !== undefined) {
      const value = pending[m[1]];
      delete pending[m[1]];
      return `${m[1]}=${value}`;
    }
    return line;
  });
  for (const [key, value] of Object.entries(pending)) out.push(`${key}=${value}`);
  while (out.length && out[out.length - 1] === '') out.pop();
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, `${out.join('\n')}\n`, 'utf8');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('图片太大，请压缩到 30MB 以内再试'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function serveStatic(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

function pickImageUrl(payload) {
  const choices = payload?.output?.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const content = choice?.message?.content;
      if (typeof content === 'string' && content.startsWith('http')) return content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part?.image === 'string') return part.image;
        }
      }
    }
  }
  const direct = payload?.output?.results?.[0]?.url;
  return typeof direct === 'string' ? direct : null;
}

async function toLineart({ image, prompt, negativePrompt }) {
  if (!CONFIG.apiKey || CONFIG.apiKey.includes('xxxxxxxx')) {
    throw Object.assign(new Error('还没有配置 DASHSCOPE_API_KEY，请复制 .env.example 为 .env 并填入你的 key'), {
      status: 400,
    });
  }

  const body = {
    model: CONFIG.model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ image }, { text: prompt }],
        },
      ],
    },
    parameters: {
      n: 1,
      prompt_extend: CONFIG.promptExtend,
      watermark: false,
    },
  };
  if (negativePrompt) body.parameters.negative_prompt = negativePrompt;

  const response = await fetch(CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.code || text.slice(0, 500);
    throw Object.assign(new Error(`模型接口报错 (${response.status})：${message}`), { status: 502 });
  }

  const resultUrl = pickImageUrl(payload);
  if (!resultUrl) {
    throw Object.assign(new Error('模型没有返回图片，可能是内容审核未通过，换张图或换个提示词再试'), {
      status: 502,
    });
  }

  // 结果 URL 24 小时后失效，且跨域会污染 canvas 导致无法导出，所以在服务端转成 base64
  const imageResponse = await fetch(resultUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imageResponse.ok) {
    throw Object.assign(new Error(`下载生成结果失败 (${imageResponse.status})`), { status: 502 });
  }
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const mime = imageResponse.headers.get('content-type')?.split(';')[0] || 'image/png';
  return { image: `data:${mime};base64,${buffer.toString('base64')}`, requestId: payload?.request_id };
}

const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp|bmp);base64,[A-Za-z0-9+/=]+$/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      model: CONFIG.model,
      endpoint: CONFIG.endpoint,
      ready: Boolean(CONFIG.apiKey) && !CONFIG.apiKey.includes('xxxxxxxx'),
      envFile: ENV_FILE,
    });
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'POST') {
    const remote = req.socket.remoteAddress || '';
    const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!isLoopback) {
      sendJson(res, 403, { error: '设置只允许在本机修改' });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: '请求体不是合法 JSON' });
      return;
    }
    const updates = {};
    if (typeof payload?.apiKey === 'string' && payload.apiKey.trim()) {
      updates.DASHSCOPE_API_KEY = payload.apiKey.trim();
    }
    if (typeof payload?.model === 'string' && payload.model.trim()) {
      updates.QWEN_IMAGE_MODEL = payload.model.trim();
    }
    if (!Object.keys(updates).length) {
      sendJson(res, 400, { error: '没有要保存的修改：key 或模型至少填一项' });
      return;
    }
    try {
      persistEnv(updates);
    } catch (err) {
      sendJson(res, 500, { error: `写入 .env 失败：${err.message}` });
      return;
    }
    if (updates.DASHSCOPE_API_KEY) CONFIG.apiKey = updates.DASHSCOPE_API_KEY;
    if (updates.QWEN_IMAGE_MODEL) CONFIG.model = updates.QWEN_IMAGE_MODEL;
    sendJson(res, 200, {
      model: CONFIG.model,
      ready: Boolean(CONFIG.apiKey) && !CONFIG.apiKey.includes('xxxxxxxx'),
      envFile: ENV_FILE,
    });
    return;
  }

  if (url.pathname === '/api/lineart' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (err) {
      sendJson(res, 400, { error: err.message || '请求体不是合法 JSON' });
      return;
    }
    const { image, prompt, negativePrompt } = payload || {};
    if (typeof image !== 'string' || !IMAGE_DATA_URL.test(image)) {
      sendJson(res, 400, { error: 'image 字段必须是 png/jpeg/webp/bmp 的 base64 data URL' });
      return;
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      sendJson(res, 400, { error: 'prompt 不能为空' });
      return;
    }
    try {
      const result = await toLineart({
        image,
        prompt: prompt.trim(),
        negativePrompt: typeof negativePrompt === 'string' ? negativePrompt.trim() : '',
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message || '转换失败' });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(res, url.pathname);
    return;
  }

  res.writeHead(405).end('Method Not Allowed');
});

function lanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}

export function start(port = CONFIG.port) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') reject(new Error(`端口 ${port} 已被占用，先关掉另一个实例或改 .env 里的 PORT`));
      else reject(err);
    });
    server.listen(port, () => {
      const actual = server.address().port;
      console.log(`线稿格子工具已启动: http://localhost:${actual}`);
      for (const address of lanAddresses()) {
        console.log(`手机同 Wi-Fi 访问: http://${address}:${actual}`);
      }
      console.log(`模型: ${CONFIG.model}`);
      if (!CONFIG.apiKey || CONFIG.apiKey.includes('xxxxxxxx')) {
        console.log('提示: 尚未配置 DASHSCOPE_API_KEY，只能使用「直接加载线稿」功能');
      }
      resolve(actual);
    });
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  start().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
