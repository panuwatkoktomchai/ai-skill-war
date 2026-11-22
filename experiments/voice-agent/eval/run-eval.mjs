// รันชุดทดสอบผ่าน Gemini Live (ส่งบทผู้โทรเป็นข้อความ แทนเสียง) แล้วให้คะแนนด้วย risk.js ตัวเดียวกับหน้าเว็บ
// ใช้: npm run eval            (1 รอบ)
//      RUNS=3 npm run eval     (ทุกบทรัน 3 รอบ ดูว่าผลนิ่งไหม)
// ผลเขียนลง eval/results.md

import { writeFile } from 'node:fs/promises';
import { GoogleGenAI, Modality } from '@google/genai';
import { REPORT_CALL_TOOL, buildSystemInstruction } from '../public/agent-config.js';
import { scoreCall } from '../public/risk.js';
import { CASES } from './cases.mjs';

const MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.8-live';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const RUNS = Number(process.env.RUNS ?? 1);
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

const signalSummary = (r) =>
  r.result.reasons.map((x) => `${x.weight > 0 ? '+' : ''}${x.weight} ${x.label.split(' ')[0]}`).join(' · ') || '-';

async function main() {
  const queue = CASES.flatMap((c) => Array.from({ length: RUNS }, (_, run) => ({ c, run: run + 1 })));
  const results = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const { c, run } = queue.shift();
        try {
          const r = { ...(await runCase(c)), run };
          results.push(r);
          console.log(`${r.pass ? '✅' : '❌'} ${c.id}#${run} ${c.title} → ${r.result.action} (${r.result.verdict} ${r.result.score ?? '-'})`);
        } catch (err) {
          results.push({ ...c, run, error: err.message, pass: false, aiText: '', result: { action: 'error', verdict: 'error', score: null, reasons: [] } });
          console.log(`💥 ${c.id}#${run} ${err.message}`);
        }
      }
    }),
  );

  // สรุปรายบท: ผ่านกี่รอบจาก RUNS รอบ
  const byCase = CASES.map((c) => {
    const runs = results.filter((r) => r.id === c.id).sort((a, b) => a.run - b.run);
    return { c, runs, passes: runs.filter((r) => r.pass).length };
  });

  const all = results.length;
  const passed = results.filter((r) => r.pass).length;
  const scamRuns = results.filter((r) => r.expected === 'end');
  const legitRuns = results.filter((r) => r.expected === 'transfer');
  const scamLeaked = scamRuns.filter((r) => r.result.action === 'transfer').length;
  const legitBlocked = legitRuns.filter((r) => r.result.action !== 'transfer').length;
  const errors = results.filter((r) => r.error).length;
  const unstable = byCase.filter((x) => x.passes > 0 && x.passes < x.runs.length);
  const hard = results.filter((r) => r.hard);

  const lines = [
    `# ผลชุดทดสอบ (${new Date().toLocaleString('th-TH')} · ${MODEL} · ${CASES.length} บท × ${RUNS} รอบ)`,
    '',
    `- ถูกรวม **${passed}/${all}** รอบ (บทยากถูก ${hard.filter((r) => r.pass).length}/${hard.length})`,
    `- มิจฉาชีพหลุดไปถึงยาย (อันตรายที่สุด): **${scamLeaked}/${scamRuns.length}** รอบ`,
    `- สายจริงโดนกัน ไม่ได้โอนให้ยาย: **${legitBlocked}/${legitRuns.length}** รอบ`,
    `- บทที่ผลไม่นิ่ง (บางรอบถูกบางรอบผิด): **${unstable.length}** บท${unstable.length ? ` (${unstable.map((x) => x.c.id).join(', ')})` : ''}`,
    errors ? `- รอบที่ error: ${errors}` : '',
    '',
    '| | case | ควรเป็น | ผ่าน | ผลแต่ละรอบ (คะแนน) | สัญญาณรอบแรก |',
    '|---|---|---|---|---|---|',
    ...byCase.map(({ c, runs, passes }) => {
      const mark = passes === runs.length ? '✅' : passes === 0 ? '❌' : '⚠️';
      const each = runs.map((r) => `${r.result.action} ${r.result.score ?? '-'}`).join(' / ');
      return `| ${mark} | ${c.id} ${c.hard ? '(ยาก) ' : ''}${c.title} | ${c.expected} | ${passes}/${runs.length} | ${each} | ${runs[0] ? signalSummary(runs[0]) : '-'} |`;
    }),
    '',
    '## รายละเอียดรอบที่ผิด',
    ...results
      .filter((r) => !r.pass)
      .sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run)
      .flatMap((r) => [
        '',
        `### ${r.id}#${r.run} ${r.title}`,
        `- ได้: ${r.result.action} (${r.result.verdict} ${r.result.score ?? '-'}) · สัญญาณ: ${signalSummary(r)}`,
        `- AI พูด: ${r.aiText.trim()}`,
        `- evidence: \`${JSON.stringify(r.report?.evidence ?? null)}\``,
        r.error ? `- error: ${r.error}` : '',
      ]),
  ];
  await writeFile(new URL('./results.md', import.meta.url), lines.join('\n'));
  console.log(
    `\nถูก ${passed}/${all} · มิจฉาชีพหลุด ${scamLeaked}/${scamRuns.length} · สายจริงโดนกัน ${legitBlocked}/${legitRuns.length} · ไม่นิ่ง ${unstable.length} บท · error ${errors}`,
  );
}

await main();
