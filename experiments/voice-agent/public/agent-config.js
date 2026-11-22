// บุคลิก + เครื่องมือของผู้ช่วย AI ที่รับสายแทนผู้สูงอายุ
// ระบบคิดคะแนนอยู่ใน risk.js · ไฟล์นี้กำหนดแค่ว่า AI ต้องคุยยังไงและต้องจับสัญญาณอะไร

import { SIGNALS, isInternationalNumber, signalSchemaProperties } from './risk.js';

export const ELDER_NAME = 'คุณแดง';

export const VOICE_NAME = 'Kore';

function describeCaller(callerNumber) {
  const number = callerNumber?.trim();
  if (!number) return 'ระบบไม่ทราบเบอร์ที่โทรเข้า';
  const intl = isInternationalNumber(number) ? ' และเป็นสายจากต่างประเทศ' : '';
  return `เบอร์ที่โทรเข้าคือ ${number} (ไม่อยู่ในรายชื่อของ${ELDER_NAME})${intl}`;
}

const signalList = SIGNALS.map((s) => `- ${s.key}: ${s.label}`).join('\n');

export function buildSystemInstruction(callerNumber) {
  return `
คุณคือ "ผู้ช่วยหลานAI" ทำหน้าที่รับสายโทรศัพท์แทน${ELDER_NAME} ผู้สูงอายุอายุ 74 ปีที่อยู่บ้านคนเดียว
สายที่เข้ามาหาคุณคือสายจากเบอร์ที่${ELDER_NAME}ไม่ได้บันทึกไว้

ข้อมูลจากระบบ (ผู้โทรไม่รู้ว่าคุณเห็นข้อมูลนี้)
- ${describeCaller(callerNumber)}
- ถ้าผู้โทรบอกว่า "ติดต่อกลับเบอร์นี้" ให้ถือว่าเบอร์ติดต่อกลับคือเบอร์ที่โทรเข้า ไม่ต้องถามซ้ำ

วิธีคุย
- พูดภาษาไทยเท่านั้น สุภาพ ใช้คำลงท้าย "ค่ะ" ประโยคสั้น ถามทีละเรื่อง
- เปิดสายทุกครั้งว่า "สวัสดีค่ะ ดิฉันเป็นผู้ช่วย AI ของ${ELDER_NAME} ตอนนี้${ELDER_NAME}ไม่สะดวกรับสาย ขอทราบชื่อและธุระด้วยค่ะ"
- สิ่งที่ต้องถามให้ได้: ชื่อผู้โทร, หน่วยงานหรือบริษัท, ธุระ, เบอร์ติดต่อกลับ
- ถ้าผู้โทรอ้างว่าเป็นเจ้าหน้าที่ ให้ถามชื่อหน่วยงานเต็มและเลขที่เรื่องหรือเลขคดี
- ถามไม่เกิน 3 คำถาม แล้วจบสาย

ห้ามเด็ดขาด
- ห้ามบอกข้อมูลส่วนตัวของ${ELDER_NAME} เช่น เลขบัตรประชาชน เลขบัญชี ที่อยู่ รหัส OTP
- ห้ามรับปากว่าจะโอนเงิน กดลิงก์ ติดตั้งแอป หรือแอดไลน์ใคร
- ห้ามบอกผู้โทรว่าคุณสงสัยว่าเขาเป็นมิจฉาชีพ

งานของคุณตอนจบสาย: จับสัญญาณ (ไม่ต้องตัดสินเอง ระบบจะคิดคะแนนให้)
ให้เรียกเครื่องมือ report_call หนึ่งครั้ง เมื่อได้ข้อมูลครบ หรือผู้โทรไม่ยอมบอก หรือผู้โทรจะวางสาย
ใน signals ให้ตอบ true เฉพาะสัญญาณที่ผู้โทรพูดหรือทำจริงในสายนี้ ห้ามเดา
และใน evidence ให้ยกคำพูดของผู้โทรสั้นๆ เป็นหลักฐานของทุกสัญญาณที่ตอบ true
${signalList}

หลังเรียก report_call ระบบจะตอบ action กลับมา ให้ทำตามนั้นเท่านั้น
- action = "transfer": พูดว่า "รอสักครู่นะคะ ดิฉันจะโอนสายให้${ELDER_NAME}ค่ะ"
- action = "end": พูดลาว่า "ขอบคุณค่ะ ดิฉันจะแจ้ง${ELDER_NAME}ให้ทราบนะคะ" ห้ามบอกว่าจะโอนสาย
`.trim();
}

const evidenceProperties = Object.fromEntries(
  SIGNALS.map((s) => [s.key, { type: 'STRING', description: `คำพูดผู้โทรที่เป็นหลักฐานของ ${s.key}` }]),
);

export const REPORT_CALL_TOOL = {
  name: 'report_call',
  description: 'สรุปสายที่รับแทนผู้สูงอายุ และรายงานสัญญาณที่จับได้ เรียกครั้งเดียวตอนใกล้จบสาย',
  parameters: {
    type: 'OBJECT',
    properties: {
      caller_name: { type: 'STRING', description: 'ชื่อที่ผู้โทรบอก ถ้าไม่บอกให้ใส่ "ไม่บอกชื่อ"' },
      claimed_organization: { type: 'STRING', description: 'หน่วยงานหรือบริษัทที่ผู้โทรอ้าง ถ้าไม่บอกใส่ "-"' },
      purpose: { type: 'STRING', description: 'ธุระของผู้โทร สรุปสั้นๆ 1 ประโยค' },
      callback_number: {
        type: 'STRING',
        description: 'เบอร์ติดต่อกลับ ถ้าผู้โทรบอกว่า "เบอร์นี้" ให้ใส่เบอร์ที่โทรเข้า ถ้าไม่ให้เลยใส่ "-"',
      },
      signals: {
        type: 'OBJECT',
        description: 'true เฉพาะสัญญาณที่เกิดขึ้นจริงในสายนี้',
        properties: signalSchemaProperties(),
        required: SIGNALS.map((s) => s.key),
      },
      evidence: {
        type: 'OBJECT',
        description: 'คำพูดผู้โทรที่เป็นหลักฐาน ใส่เฉพาะสัญญาณที่ตอบ true',
        properties: evidenceProperties,
      },
    },
    required: ['caller_name', 'claimed_organization', 'purpose', 'callback_number', 'signals'],
  },
};

// ข้อความ LINE สร้างจากผลคะแนน (ไม่ให้ AI เขียนเอง จะได้ตรงกับการตัดสินเสมอ)
export function buildFamilyMessage(report, result) {
  const who = [report.caller_name, report.claimed_organization].filter((x) => x && x !== '-').join(' · ') || 'ผู้โทรไม่บอกชื่อ';
  const purpose = report.purpose ?? '';
  if (result.verdict === 'scam') {
    return `⚠️ สายมิจฉาชีพ: ${who} ${purpose} · ห้ามโอนเงิน ห้ามให้ข้อมูล และไม่ต้องโทรกลับนะคะ`;
  }
  if (result.verdict === 'suspicious') {
    return `❓ สายน่าสงสัย: ${who} ${purpose} · ถ้าจะโทรกลับ ให้โทรเบอร์ทางการของหน่วยงานนั้นเอง ไม่ใช่เบอร์ที่เขาให้ค่ะ`;
  }
  return `✅ โอนสายให้แล้ว: ${who} ${purpose}`;
}

// บทให้คนทดสอบอ่าน (เล่นเป็นผู้โทร) · ชุดใหญ่สำหรับวัดผลอยู่ใน eval/cases.mjs
export const TEST_SCRIPTS = [
  {
    title: 'ตำรวจปลอม',
    lines: 'ผมจ่าสมชาย จาก สภ.เมืองเชียงใหม่ ครับ บัญชีของคุณแดงถูกใช้ฟอกเงิน ต้องโอนเงินมาตรวจสอบภายในวันนี้ ห้ามบอกใครนะครับ',
  },
  {
    title: 'พัสดุผิดกฎหมาย',
    lines: 'ติดต่อจากบริษัทขนส่งค่ะ มีพัสดุชื่อคุณแดงมียาเสพติดอยู่ข้างใน ให้แอดไลน์เจ้าหน้าที่เพื่อยืนยันตัวตนนะคะ',
  },
  {
    title: 'ลูกปลอม',
    lines: 'แม่ ผมเองนะ เปลี่ยนเบอร์ใหม่ ตอนนี้ผมรถชนต้องใช้เงินด่วนสองหมื่น โอนมาให้หน่อย อย่าเพิ่งบอกใครนะ',
  },
  {
    title: 'สายจริง: ศูนย์บริการสาธารณสุข',
    lines: 'สวัสดีค่ะ พยาบาลสมใจจากศูนย์บริการสาธารณสุข 23 ค่ะ โทรมานัดคุณแดงวัดความดันวันพฤหัสนี้ค่ะ ติดต่อกลับเบอร์นี้ได้เลยค่ะ',
  },
];
