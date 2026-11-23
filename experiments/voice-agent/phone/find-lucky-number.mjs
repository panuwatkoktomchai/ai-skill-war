// ค้นเบอร์ US Local ที่ว่างบน Twilio แล้วจัดอันดับตามเลขศาสตร์ (ค้นอย่างเดียว ไม่ซื้อ ไม่เสียเงิน)
// รัน: node --env-file=.env phone/find-lucky-number.mjs [ลงท้าย ...]
//   ไม่ใส่ = ใช้ชุดลงท้ายตั้งต้นด้านล่าง
// เกณฑ์ (ได้จากการคุยกับ ChatGPT 23 พ.ย.): ดูคู่เลขติดกันครบทั้ง 9 คู่ของ 10 หลัก (ไม่นับ +1)
//   คู่เลข 60% · ผลรวม 10 หลัก 25% · จำง่าย (4 หลักท้ายใช้เลขไม่เกิน 2 ตัว) 15%

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
if (!sid || !token) {
  console.error('ยังไม่มี TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN ใน .env');
  process.exit(1);
}
const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;

const DEFAULT_ENDINGS = ['2459', '5459', '4559', '2959', '9559', '5959', '9595', '4595', '5995', '8995', '9959', '9989', '4599'];
const GOOD_PAIRS = new Set(['24', '42', '45', '54', '55', '59', '95', '29', '92', '89', '98', '99']);
const BAD_PAIRS = new Set(['13', '31', '37', '73', '67', '76', '77', '17', '71', '70', '07', '18', '81', '58', '85', '20', '02', '60', '06', '08', '80']);
const TOP_SUMS = new Set([55, 59, 65]);
const OK_SUMS = new Set([45, 51, 54, 56, 63]);
const BAD_PAIR_PENALTY = 1.5;
const RESULT_LIMIT = 25;

const endings = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ENDINGS;
const digitSum = (s) => [...s].reduce((a, d) => a + Number(d), 0);
const pairsOf = (s) => Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2));

// "$" ท้าย pattern = บังคับให้ลงท้ายด้วยเลขนั้น (Twilio รองรับ)
async function searchEndingWith(ending) {
  const q = new URLSearchParams({ Contains: `${ending}$`, VoiceEnabled: 'true', PageSize: '50' });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?${q}`, {
    headers: { authorization: auth },
  });
  if (!res.ok) throw new Error(`${ending}: ${res.status} ${await res.text()}`);
  return (await res.json()).available_phone_numbers ?? [];
}

function evaluate(e164) {
  const ten = e164.slice(2);
  const pairs = pairsOf(ten);
  const good = pairs.filter((p) => GOOD_PAIRS.has(p)).length;
  const bad = pairs.filter((p) => BAD_PAIRS.has(p));
  const pairScore = Math.max(0, Math.min(100, ((good - BAD_PAIR_PENALTY * bad.length) / pairs.length) * 100));
  const sum10 = digitSum(ten);
  const sumScore = TOP_SUMS.has(sum10) ? 100 : OK_SUMS.has(sum10) ? 80 : 0;
  const distinctLast4 = new Set(ten.slice(-4)).size;
  const memoScore = distinctLast4 <= 2 ? 100 : distinctLast4 === 3 ? 50 : 0;
  return {
    score: Math.round(0.6 * pairScore + 0.25 * sumScore + 0.15 * memoScore),
    sum10,
    good,
    pairs: pairs.join('-'),
    bad: bad.join(',') || '-',
  };
}

const found = new Map();
for (const ending of endings) {
  try {
    for (const n of await searchEndingWith(ending)) found.set(n.phone_number, n);
  } catch (e) {
    console.error('ค้นไม่สำเร็จ', e.message);
  }
}

const rows = [...found.values()]
  .map((n) => ({ number: n.phone_number, where: `${n.locality ?? '-'}, ${n.region ?? '-'}`, ...evaluate(n.phone_number) }))
  .sort((a, b) => b.score - a.score || b.sum10 - a.sum10);

console.log(`เจอ ${rows.length} เบอร์ (คะแนน · เบอร์ · ผลรวม 10 หลัก · คู่ดี/9 · คู่เลข · คู่เสีย · พื้นที่)\n`);
for (const r of rows.slice(0, RESULT_LIMIT)) {
  console.log(`${r.score}\t${r.number}\t${r.sum10}\t${r.good}/9\t${r.pairs}\t${r.bad}\t${r.where}`);
}
