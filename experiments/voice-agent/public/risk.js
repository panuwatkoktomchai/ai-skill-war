// ระบบให้คะแนนความเสี่ยงมิจฉาชีพ
// หลักการ: AI แค่ "จับสัญญาณ" จากบทสนทนา (ติ๊กว่าเจอ/ไม่เจอ + ยกคำพูดเป็นหลักฐาน)
//          โค้ดนี้เป็นคน "คิดคะแนน" และ "ตัดสินว่าโอนสายหรือแจ้ง LINE"
// น้ำหนักทั้งหมดเป็นค่าตั้งต้นที่ทีมกำหนดเอง แล้วจูนด้วยชุดทดสอบใน eval/ (ไม่ได้มาจากงานวิจัย)

// สัญญาณที่ AI ต้องจับ · weight บวก = เสี่ยงขึ้น · ลบ = น่าเชื่อขึ้น
export const SIGNALS = [
  {
    key: 'money_request',
    label: 'ขอให้โอนเงิน จ่ายค่าธรรมเนียม หรือฝากเงินเพื่อตรวจสอบ',
    weight: 40,
    blocksTransfer: true,
  },
  {
    key: 'sensitive_info_request',
    label: 'ขอ OTP รหัส เลขบัตร เลขบัญชี หรือข้อมูลส่วนตัว',
    weight: 35,
    blocksTransfer: true,
  },
  {
    key: 'authority_threat',
    label: 'อ้างเป็นตำรวจ ศาล DSI ธนาคาร หรือหน่วยงานรัฐ แล้วบอกว่ามีคดี บัญชีมีปัญหา หรือพัสดุผิดกฎหมาย',
    weight: 30,
  },
  {
    key: 'channel_switch',
    label: 'ให้ติดตั้งแอป กดลิงก์ แอดไลน์ ย้ายไปคุยช่องทางอื่น หรือให้เซฟเบอร์ใหม่แล้วเลิกใช้หรือลบเบอร์เดิม',
    weight: 30,
    blocksTransfer: true,
  },
  {
    key: 'family_impersonation',
    label: 'อ้างเป็นลูกหลาน ญาติ หรือคนรู้จักจากเบอร์แปลก แล้วขอเงิน ขอให้ช่วยด่วน หรือขอข้อมูล',
    weight: 30,
  },
  {
    // มิจฉาชีพลูกปลอมต้องขออะไรสักอย่างเสมอ ถ้าแค่ฝากข่าวให้น้ำหนักต่ำ ไม่งั้นหลานยืมโทรศัพท์เพื่อนจะโดนกันทุกครั้ง
    key: 'family_unknown_number',
    label: 'อ้างเป็นลูกหลานหรือคนรู้จักจากเบอร์แปลก แต่ไม่ได้ขออะไร แค่ฝากข่าว',
    weight: 10,
  },
  {
    key: 'too_good_offer',
    label: 'เสนอผลตอบแทนสูง รางวัล เงินคืน สิทธิพิเศษ หรืองานรายได้ดี',
    weight: 25,
  },
  {
    key: 'pressure_secrecy',
    label: 'เร่งให้ทำทันที ข่มขู่ หรือสั่งห้ามบอกคนอื่น',
    weight: 20,
  },
  {
    key: 'evasive_or_inconsistent',
    label: 'ไม่ยอมบอกชื่อ หน่วยงาน หรือเบอร์กลับ หรือข้อมูลขัดกันเอง',
    weight: 15,
  },
  {
    key: 'verifiable_identity',
    label: 'บอกชื่อ หน่วยงาน และเบอร์กลับครบ ข้อมูลสอดคล้องกัน',
    weight: -15,
  },
  {
    key: 'routine_purpose',
    label: 'ธุระทั่วไปที่ไม่เกี่ยวกับเงินหรือข้อมูลลับ เช่น นัดหมาย แจ้งข่าว ส่งของ',
    weight: -15,
  },
  {
    key: 'official_channel_offered',
    label: 'ให้ยายติดต่อกลับเองผ่านช่องทางทางการ หรือให้ไปทำเรื่องที่สำนักงาน',
    weight: -10,
  },
];

// สัญญาณจากระบบ (ไม่ได้มาจาก AI) · กสทช. บังคับให้สายจากต่างประเทศขึ้นต้นด้วยรหัสเหล่านี้
export const INTERNATIONAL_PREFIXES = ['+697', '+698'];
export const INTERNATIONAL_CALL_WEIGHT = 20;

export const VERDICT_THRESHOLDS = { scam: 60, suspicious: 30 };

export function isInternationalNumber(number) {
  const n = (number ?? '').replace(/[\s-]/g, '');
  return INTERNATIONAL_PREFIXES.some((p) => n.startsWith(p));
}

const clamp = (x) => Math.max(0, Math.min(100, x));

// รับ signals จาก AI ({ money_request: true, ... }) + เบอร์ที่โทรเข้า
// คืน { score, verdict, action, reasons: [{label, weight, evidence}] }
export function scoreCall(signals = {}, evidence = {}, callerNumber = '') {
  const reasons = [];
  let blocked = false;

  for (const s of SIGNALS) {
    if (signals[s.key] !== true) continue;
    reasons.push({ label: s.label, weight: s.weight, evidence: evidence[s.key] ?? '' });
    if (s.blocksTransfer) blocked = true;
  }
  if (isInternationalNumber(callerNumber)) {
    reasons.push({ label: 'โทรมาจากต่างประเทศ (+697 / +698)', weight: INTERNATIONAL_CALL_WEIGHT, evidence: callerNumber });
  }

  const score = clamp(reasons.reduce((sum, r) => sum + r.weight, 0));
  let verdict = 'legit';
  if (score >= VERDICT_THRESHOLDS.scam) verdict = 'scam';
  else if (score >= VERDICT_THRESHOLDS.suspicious) verdict = 'suspicious';
  // ขอเงิน / ข้อมูลลับ / ย้ายช่องทาง = ห้ามโอนสายเด็ดขาด ต่อให้คะแนนรวมต่ำ
  if (blocked && verdict === 'legit') verdict = 'suspicious';

  const action = verdict === 'legit' ? 'transfer' : 'end';
  return { score, verdict, action, reasons };
}

// สร้าง schema ของ function report_call จากรายการสัญญาณ (แหล่งเดียว ไม่ต้องเขียนซ้ำ)
export function signalSchemaProperties() {
  const props = {};
  for (const s of SIGNALS) {
    props[s.key] = { type: 'BOOLEAN', description: s.label };
  }
  return props;
}
