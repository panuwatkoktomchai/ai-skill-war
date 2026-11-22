// เรื่อง Twilio: สร้าง TwiML · ตรวจลายเซ็น webhook · สั่งเปลี่ยนสายที่กำลังคุยอยู่ (โอน / วาง)

import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.twilio.com/2010-04-01';

const escapeXml = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

// ให้ Twilio เปิด media stream สองทางมาที่ WebSocket ของเรา พร้อมส่งเบอร์ผู้โทรไปด้วย
export function streamTwiml(wsUrl, params) {
  const p = Object.entries(params)
    .map(([k, v]) => `<Parameter name="${escapeXml(k)}" value="${escapeXml(v ?? '')}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(wsUrl)}">${p}</Stream></Connect></Response>`;
}

export const dialTwiml = (to, callerId) =>
  `<Response><Dial callerId="${escapeXml(callerId)}" timeout="25">${escapeXml(to)}</Dial></Response>`;

export const hangupTwiml = () => '<Response><Hangup/></Response>';

// ลายเซ็น X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + key1value1 + key2value2 ...)) เรียง key ตามตัวอักษร
export function isValidTwilioSignature({ authToken, url, params, signature }) {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// เปลี่ยนสิ่งที่สายนี้ทำอยู่ด้วย TwiML ใหม่ (stream จะถูกตัด แล้วทำตาม TwiML ใหม่แทน)
export async function updateCall({ accountSid, authToken, callSid, twiml }) {
  const res = await fetch(`${API}/Accounts/${accountSid}/Calls/${callSid}.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ Twiml: twiml }),
  });
  if (!res.ok) throw new Error(`Twilio update call ${res.status}: ${await res.text()}`);
}
