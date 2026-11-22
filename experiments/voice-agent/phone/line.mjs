// ส่ง LINE ถึงยายและลูกหลาน
// วันทดลองใช้ broadcast (ส่งถึงเพื่อนทุกคนของ OA) จะได้ไม่ต้องเก็บ user ID · ของจริงต้องใช้ push ระบุ userId

const BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

export async function broadcastLine(token, text) {
  if (!token) {
    console.warn('[line] ไม่มี LINE_CHANNEL_ACCESS_TOKEN ข้ามการส่ง:', text);
    return;
  }
  const res = await fetch(BROADCAST_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) throw new Error(`LINE broadcast ${res.status}: ${await res.text()}`);
}
