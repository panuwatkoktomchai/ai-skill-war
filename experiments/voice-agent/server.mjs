// Spike S2: เว็บทดลอง "ผู้ช่วย AI รับสายแทนยาย" ด้วย Gemini Live
// เซิร์ฟเวอร์ทำ 3 อย่าง: เสิร์ฟไฟล์หน้าเว็บ + ออก ephemeral token ให้เบราว์เซอร์ + ส่ง LINE หลังสายจบ
// API key / LINE token จริงอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ส่งไปที่เบราว์เซอร์

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { broadcastLine, buildLineReport } from './phone/line.mjs';
import { scoreCall } from './public/risk.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 5180);
const MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.8-live';
const TOKEN_TTL_MS = 30 * 60 * 1000;
const NEW_SESSION_WINDOW_MS = 60 * 1000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
const MAX_BODY_BYTES = 32 * 1024;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('ยังไม่มี GEMINI_API_KEY ในไฟล์ .env (ดู README.md)');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });
const publicDir = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function createEphemeralToken() {
  const now = Date.now();
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + TOKEN_TTL_MS).toISOString(),
      newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
      httpOptions: { apiVersion: 'v1beta' },
    },
  });
  return token.name;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function serveStatic(pathname, res) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  // อนุญาตเฉพาะไฟล์ชั้นเดียวใน public/ กันการอ่านไฟล์นอกโฟลเดอร์
  if (!/^[a-z0-9-]+\.(html|js|css)$/.test(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(join(publicDir, file));
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body ใหญ่เกิน'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('body ไม่ใช่ JSON'));
      }
    });
    req.on('error', reject);
  });
}

// หลัง AI เรียก report_call หน้าเว็บส่งรายงานมา → คิดคะแนนใหม่ฝั่งเซิร์ฟเวอร์ (ไม่เชื่อคะแนนจากเบราว์เซอร์)
// แล้วส่ง LINE ด้วยข้อความชุดเดียวกับทางเบอร์จริง
async function notifyFamily(req) {
  const { report, callerNumber } = await readJson(req);
  if (!report || typeof report !== 'object') throw new Error('ไม่มี report');
  const result = scoreCall(report.signals, report.evidence, callerNumber);
  const sent = await broadcastLine(LINE_TOKEN, buildLineReport(report, result, callerNumber));
  return { sent, reason: sent ? undefined : 'no-token' };
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && pathname === '/api/notify') {
    try {
      sendJson(res, 200, await notifyFamily(req));
    } catch (err) {
      console.error('ส่ง LINE ไม่สำเร็จ:', err.message);
      sendJson(res, 500, { sent: false, error: err.message });
    }
    return;
  }
  if (req.method === 'POST' && pathname === '/api/session') {
    try {
      sendJson(res, 200, { token: await createEphemeralToken(), model: MODEL });
    } catch (err) {
      console.error('ออก token ไม่สำเร็จ:', err.message);
      sendJson(res, 500, { error: err.message });
    }
    return;
  }
  if (req.method === 'GET') {
    await serveStatic(pathname, res);
    return;
  }
  res.writeHead(405).end();
});

server.listen(PORT, HOST, () => {
  console.log(`เปิดหน้าทดลองที่ http://localhost:${PORT}  (model: ${MODEL})`);
  console.log(LINE_TOKEN ? 'LINE: ส่งจริง (broadcast)' : 'LINE: ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN · แสดงการ์ดบนจออย่างเดียว');
});
