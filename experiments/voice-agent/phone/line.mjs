// ส่ง LINE ถึงยายและลูกหลาน · ใช้ทั้งทางเบอร์จริง (phone/) และหน้าเว็บเดโม (server.mjs)
// วันทดลองใช้ broadcast (ส่งถึงเพื่อนทุกคนของ OA) จะได้ไม่ต้องเก็บ user ID · ของจริงต้องใช้ push ระบุ userId

import { buildFamilyMessage } from '../public/agent-config.js';

const BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';
const LINE_TEXT_LIMIT = 4900;

// ข้อความ LINE หลังสายจบ: ข้อความถึงครอบครัว + เบอร์ + คะแนน + ที่มาของคะแนน
export function buildLineReport(report, result, from) {
  const reasons = result.reasons.map((r) => `${r.weight > 0 ? '+' : ''}${r.weight} ${r.label}`).join('\n');
  return [
    buildFamilyMessage(report, result),
    '',
    `เบอร์ที่โทรเข้า: ${from || '-'}`,
    `คะแนนเสี่ยง: ${result.score}/100`,
    reasons ? `ที่มาของคะแนน:\n${reasons}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// คืน true ถ้าส่งแล้ว · false ถ้ายังไม่ได้ตั้ง token (ข้ามการส่ง)
export async function broadcastLine(token, text) {
  if (!token) {
    console.warn('[line] ไม่มี LINE_CHANNEL_ACCESS_TOKEN ข้ามการส่ง:', text);
    return false;
  }
  const res = await fetch(BROADCAST_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ type: 'text', text: text.slice(0, LINE_TEXT_LIMIT) }] }),
  });
  if (!res.ok) throw new Error(`LINE broadcast ${res.status}: ${await res.text()}`);
  return true;
}
