// รันชุดทดสอบผ่าน Gemini Live (ส่งบทผู้โทรเป็นข้อความ แทนเสียง) แล้วให้คะแนนด้วย risk.js ตัวเดียวกับหน้าเว็บ
// ใช้: npm run eval   (ผลเขียนลง eval/results.md)

import { writeFile } from 'node:fs/promises';
import { GoogleGenAI, Modality } from '@google/genai';
import { REPORT_CALL_TOOL, buildSystemInstruction } from '../public/agent-config.js';
import { scoreCall } from '../public/risk.js';
import { CASES } from './cases.mjs';

const MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.8-live';
const CONCURRENCY = 3;
const TURN_TIMEOUT_MS = 25_000;
const HANGUP_LINE = 'แค่นี้ก่อนนะ วางสายแล้ว';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1beta' } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCase(c) {
  let report = null;
  let aiText = '';
  let turnDone = false;
  let session = null;

  session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: buildSystemInstruction(c.callerNumber),
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: [REPORT_CALL_TOOL] }],
    },
    callbacks: {
      onmessage: (m) => {
        if (m.toolCall && session) {
          const responses = m.toolCall.functionCalls.map((fc) => {
            if (fc.name !== REPORT_CALL_TOOL.name) return { id: fc.id, name: fc.name, response: { result: 'ok' } };
            report = fc.args ?? {};
            const r = scoreCall(report.signals, report.evidence, c.callerNumber);
            return { id: fc.id, name: fc.name, response: { action: r.action } };
          });
          session.sendToolResponse({ functionResponses: responses });
        }
        const sc = m.serverContent;
        if (sc?.outputTranscription?.text) aiText += sc.outputTranscription.text;
        if (sc?.turnComplete) {
          aiText += ' ‖ ';
          turnDone = true;
        }
      },
      onerror: (e) => console.error(c.id, 'error', e.message),
    },
  });

  const say = async (text) => {
    turnDone = false;
    session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
    for (let t = 0; t < TURN_TIMEOUT_MS / 100 && !turnDone; t++) await sleep(100);
  };

  await say('(มีสายเข้า ผู้โทรรออยู่)');
  for (const line of c.turns) {
    if (report) break;
    await say(line);
  }
  if (!report) await say(HANGUP_LINE);
  for (let t = 0; t < 80 && !report; t++) await sleep(100);
  session.close();

  const result = report
    ? scoreCall(report.signals, report.evidence, c.callerNumber)
    : { score: null, verdict: 'no_report', action: 'end', reasons: [] };
  return { ...c, report, result, aiText, pass: result.action === c.expected };
}

async function main() {
  const queue = [...CASES];
  const results = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const c = queue.shift();
        try {
          const r = await runCase(c);
          results.push(r);
          console.log(`${r.pass ? '✅' : '❌'} ${c.id} ${c.title} → ${r.result.action} (${r.result.verdict} ${r.result.score ?? '-'})`);
        } catch (err) {
          results.push({ ...c, error: err.message, pass: false, result: { action: 'error', verdict: 'error', reasons: [] } });
          console.log(`💥 ${c.id} ${err.message}`);
        }
      }
    }),
  );
  results.sort((a, b) => a.id.localeCompare(b.id));

  const passed = results.filter((r) => r.pass).length;
  const scams = results.filter((r) => r.expected === 'end');
  const legits = results.filter((r) => r.expected === 'transfer');
  const scamLeaked = scams.filter((r) => r.result.action === 'transfer').length;
  const legitBlocked = legits.filter((r) => r.result.action !== 'transfer').length;

  const lines = [
    `# ผลชุดทดสอบ (${new Date().toLocaleString('th-TH')} · ${MODEL})`,
    '',
    `- ถูก **${passed}/${results.length}**`,
    `- มิจฉาชีพหลุดไปถึงยาย (อันตรายที่สุด): **${scamLeaked}/${scams.length}**`,
    `- สายจริงโดนกัน ไม่ได้โอนให้ยาย: **${legitBlocked}/${legits.length}**`,
    '',
    '| | case | ควรเป็น | ได้ | คะแนน | สัญญาณที่ AI จับได้ |',
    '|---|---|---|---|---|---|',
    ...results.map((r) => {
      const sig = r.result.reasons.map((x) => `${x.weight > 0 ? '+' : ''}${x.weight} ${x.label.split(' ')[0]}`).join(' · ') || '-';
      return `| ${r.pass ? '✅' : '❌'} | ${r.id} ${r.title} | ${r.expected} | ${r.result.action} (${r.result.verdict}) | ${r.result.score ?? '-'} | ${sig} |`;
    }),
    '',
    '## รายละเอียดเคสที่ผิด',
    ...results
      .filter((r) => !r.pass)
      .flatMap((r) => [
        '',
        `### ${r.id} ${r.title}`,
        `- AI พูด: ${r.aiText.trim()}`,
        `- signals: \`${JSON.stringify(r.report?.signals ?? null)}\``,
        `- evidence: \`${JSON.stringify(r.report?.evidence ?? null)}\``,
        r.error ? `- error: ${r.error}` : '',
      ]),
  ];
  await writeFile(new URL('./results.md', import.meta.url), lines.join('\n'));
  console.log(`\nถูก ${passed}/${results.length} · มิจฉาชีพหลุด ${scamLeaked}/${scams.length} · สายจริงโดนกัน ${legitBlocked}/${legits.length}`);
}

await main();
