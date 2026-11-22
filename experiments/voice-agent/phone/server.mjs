// เซิร์ฟเวอร์เบอร์ AI (ระดับ 2: โทรเข้าเบอร์จริง)
// Twilio webhook POST /twilio/voice → ตอบ TwiML ให้เปิด media stream มาที่ wss://<host>/twilio/media
// รัน: npm run phone  แล้วเปิด ngrok http 5190 · ตั้ง Voice webhook ของเบอร์ Twilio เป็น https://<ngrok>/twilio/voice

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { PhoneCall } from './call-session.mjs';
import { isValidTwilioSignature, streamTwiml } from './twilio.mjs';

const REQUIRED = ['GEMINI_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_NUMBER'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('ยังไม่ได้ตั้งค่าใน .env:', missing.join(', '));
  process.exit(1);
}

const config = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.8-live',
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioNumber: process.env.TWILIO_NUMBER,
  elderPhone: process.env.ELDER_PHONE ?? '', // เบอร์ที่จะโอนสายจริงไปหา (E.164 เช่น +66812345678) · ว่าง = วางสายแทนโอน
  lineToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
};
const PORT = Number(process.env.PHONE_PORT ?? 5190);
const KNOWN_CALL_TTL_MS = 60_000;

// callSid ที่ผ่านการตรวจลายเซ็นแล้ว · stream ที่ไม่อยู่ในนี้จะถูกปฏิเสธ
const knownCalls = new Map();
const isKnownCall = (sid) => knownCalls.has(sid);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST' || pathname !== '/twilio/voice') {
    res.writeHead(404).end();
    return;
  }

  const params = Object.fromEntries(new URLSearchParams(await readBody(req)));
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const signed = isValidTwilioSignature({
    authToken: config.twilioToken,
    url: `https://${host}${req.url}`,
    params,
    signature: req.headers['x-twilio-signature'],
  });
  if (!signed) {
    console.warn('ลายเซ็น Twilio ไม่ถูกต้อง ปฏิเสธ request');
    res.writeHead(403).end();
    return;
  }

  knownCalls.set(params.CallSid, Date.now());
  setTimeout(() => knownCalls.delete(params.CallSid), KNOWN_CALL_TTL_MS);
  console.log(`webhook: สายจาก ${params.From} (${params.CallSid?.slice(-6)})`);
  res.writeHead(200, { 'content-type': 'text/xml' });
  res.end(streamTwiml(`wss://${host}/twilio/media`, { from: params.From, callSid: params.CallSid }));
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/twilio/media') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => new PhoneCall({ ws, config, isKnownCall }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`เบอร์ AI พร้อม: http://127.0.0.1:${PORT}  (model ${config.model})`);
  console.log(`โอนสายจริงไป: ${config.elderPhone || '(ยังไม่ตั้ง ELDER_PHONE → วางสายแทน)'} · LINE: ${config.lineToken ? 'พร้อม' : 'ยังไม่ตั้ง'}`);
});
