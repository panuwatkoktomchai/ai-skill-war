import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { MicStreamer, PcmPlayer } from '/audio.js';
import {
  REPORT_CALL_TOOL,
  TEST_SCRIPTS,
  VOICE_NAME,
  buildFamilyMessage,
  buildSystemInstruction,
} from '/agent-config.js';
import { scoreCall } from '/risk.js';
import { CallGuard, MAX_CALL_MS, SILENCE_HANGUP_MS } from '/call-guard.js';

// เสียงไมค์ดังเกินค่านี้ถือว่าผู้โทรกำลังพูด (กันเสียงลมหายใจ/เสียงรบกวนเบาๆ)
const CALLER_VOICE_LEVEL = 0.08;
// เวลาให้ AI พูดประโยคลาก่อนตัดสาย
const GOODBYE_GRACE_MS = 5_000;
const MAX_DURATION_GRACE_MS = 12_000;

const PHONE_RATE = 8000;
const WIDEBAND_RATE = 16000;

// ให้ระบบตัดสินเร็วขึ้นว่าผู้โทรพูดจบแล้ว (ค่าเริ่มต้นของ API รอนานกว่านี้)
// ถ้า AI ชิงพูดแทรกตอนผู้โทรเว้นจังหวะ ให้เพิ่ม SILENCE_MS
const SILENCE_MS = 500;
const VAD_CONFIG = {
  automaticActivityDetection: {
    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
    prefixPaddingMs: 100,
    silenceDurationMs: SILENCE_MS,
  },
};

const $ = (id) => document.getElementById(id);
const ui = {
  callBtn: $('call-btn'),
  status: $('status'),
  phoneMode: $('phone-mode'),
  level: $('level'),
  latency: $('latency'),
  transcript: $('transcript'),
  reports: $('reports'),
  callerNumber: $('caller-number'),
  scripts: $('scripts'),
};

let call = null; // { session, mic, player }
let lastCallerSpeechAt = 0;
let waitingFirstAudio = false;

function setStatus(text) {
  ui.status.textContent = text;
}

// รวมข้อความถอดเสียงที่มาเป็นท่อนๆ ให้อยู่บรรทัดเดียวต่อหนึ่งช่วงพูด
function appendTranscript(role, text) {
  if (!text) return;
  const last = ui.transcript.lastElementChild;
  if (last?.dataset.role === role) {
    last.querySelector('span').textContent += text;
  } else {
    const row = document.createElement('p');
    row.dataset.role = role;
    row.innerHTML = `<b>${role === 'caller' ? 'ผู้โทร' : 'AI'}:</b> <span></span>`;
    row.querySelector('span').textContent = text;
    ui.transcript.append(row);
  }
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
}

const VERDICT_LABEL = {
  scam: { text: 'มิจฉาชีพ', cls: 'bad' },
  suspicious: { text: 'น่าสงสัย', cls: 'warn' },
  legit: { text: 'สายจริง', cls: 'ok' },
};

// การ์ดผลแต่ละครั้งที่ AI เรียก report_call · ใบใหม่อยู่บนสุด ไม่ทับใบเก่า
// แสดงที่มาของคะแนนทีละสัญญาณ (น้ำหนัก + คำพูดที่เป็นหลักฐาน) ให้อธิบายกรรมการได้
function renderReport(r, result, callerNumber) {
  const v = VERDICT_LABEL[result.verdict];
  const card = document.createElement('article');
  card.className = `report ${v.cls}`;
  card.innerHTML = `
    <div class="line-head">LINE ถึงคุณแดงและลูกหลาน · <span class="f-time"></span> · <span class="f-sent">กำลังส่ง LINE...</span></div>
    <p class="line-msg"></p>
    <dl>
      <dt>ผลประเมิน</dt><dd>${v.text} · คะแนนเสี่ยง ${result.score}/100</dd>
      <dt>เบอร์ที่โทรเข้า</dt><dd class="f-in"></dd>
      <dt>ผู้โทร</dt><dd class="f-name"></dd>
      <dt>อ้างว่าเป็น</dt><dd class="f-org"></dd>
      <dt>ธุระ</dt><dd class="f-purpose"></dd>
      <dt>เบอร์กลับ</dt><dd class="f-cb"></dd>
    </dl>
    <table class="why"><caption>คะแนนมาจากไหน</caption><tbody></tbody></table>`;
  const set = (cls, text) => (card.querySelector(cls).textContent = text);
  set('.f-time', new Date().toLocaleTimeString('th-TH'));
  set('.line-msg', buildFamilyMessage(r, result));
  set('.f-in', callerNumber || '-');
  set('.f-name', r.caller_name ?? '-');
  set('.f-org', r.claimed_organization ?? '-');
  set('.f-purpose', r.purpose ?? '-');
  set('.f-cb', r.callback_number ?? '-');

  const tbody = card.querySelector('.why tbody');
  if (result.reasons.length === 0) tbody.innerHTML = '<tr><td>ไม่พบสัญญาณใด</td></tr>';
  for (const reason of result.reasons) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="w"></td><td><div class="l"></div><div class="e"></div></td>';
    tr.querySelector('.w').textContent = reason.weight > 0 ? `+${reason.weight}` : `${reason.weight}`;
    tr.querySelector('.l').textContent = reason.label;
    tr.querySelector('.e').textContent = reason.evidence ? `"${reason.evidence}"` : '';
    tbody.append(tr);
  }
  ui.reports.prepend(card);
  return card;
}

const SEND_STATUS_TEXT = {
  sent: 'ส่งเข้า LINE แล้ว',
  'no-token': 'ยังไม่ได้ตั้ง LINE token (แสดงบนจออย่างเดียว)',
  failed: 'ส่ง LINE ไม่สำเร็จ',
};

// ส่งรายงานให้เซิร์ฟเวอร์ส่ง LINE จริง · เซิร์ฟเวอร์คิดคะแนนใหม่เอง ไม่ใช้คะแนนจากหน้านี้
async function notifyFamily(card, report, callerNumber) {
  const label = card.querySelector('.f-sent');
  let status = 'failed';
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ report, callerNumber }),
    });
    const body = await res.json();
    if (res.ok) status = body.sent ? 'sent' : body.reason ?? 'failed';
    else console.error('notify', body.error);
  } catch (err) {
    console.error('notify', err);
  }
  label.textContent = SEND_STATUS_TEXT[status] ?? SEND_STATUS_TEXT.failed;
  label.dataset.status = status;
}

// ในระบบจริง "transfer" = Twilio โทรหามือถือยายแล้วต่อสาย + แอปเด้งบอกก่อนว่าใครโทรมา
// "end" = AI จบสาย แล้วส่ง LINE เตือนยายกับลูกหลาน
function showTransfer(report) {
  const banner = document.createElement('div');
  banner.className = 'transfer';
  banner.textContent = `กำลังโอนสายไปหาคุณแดง · มือถือคุณแดงจะขึ้นว่า "${
    report.claimed_organization ?? 'ผู้โทร'
  }: ${report.purpose ?? ''}"`;
  ui.reports.prepend(banner);
}

function handleToolCall(session, toolCall) {
  const responses = [];
  for (const fc of toolCall.functionCalls ?? []) {
    let response = { result: 'ok' };
    if (fc.name === REPORT_CALL_TOOL.name) {
      const report = fc.args ?? {};
      const result = scoreCall(report.signals, report.evidence, call?.callerNumber);
      const card = renderReport(report, result, call?.callerNumber);
      void notifyFamily(card, report, call?.callerNumber);
      if (result.action === 'transfer') showTransfer(report);
      response = { action: result.action };
      console.log('report_call', result, report);
    }
    responses.push({ id: fc.id, name: fc.name, response });
  }
  session.sendToolResponse({ functionResponses: responses });
}

function handleMessage(session, msg) {
  if (msg.toolCall && session) handleToolCall(session, msg.toolCall);

  const sc = msg.serverContent;
  if (!sc) return;

  if (sc.inputTranscription?.text) {
    call?.guard.noteCallerActivity();
    appendTranscript('caller', sc.inputTranscription.text);
    lastCallerSpeechAt = performance.now();
    waitingFirstAudio = true;
  }
  if (sc.outputTranscription?.text) appendTranscript('ai', sc.outputTranscription.text);
  if (sc.interrupted) call?.player.interrupt();

  for (const part of sc.modelTurn?.parts ?? []) {
    if (!part.inlineData?.data) continue;
    if (waitingFirstAudio && lastCallerSpeechAt) {
      ui.latency.textContent = `${Math.round(performance.now() - lastCallerSpeechAt)} ms`;
      waitingFirstAudio = false;
    }
    call?.player.play(part.inlineData.data);
  }
}

async function startCall() {
  ui.callBtn.disabled = true;
  ui.transcript.replaceChildren();
  ui.latency.textContent = '-';
  const callerNumber = ui.callerNumber.value.trim();
  setStatus('กำลังขอ token...');

  const res = await fetch('/api/session', { method: 'POST' });
  const { token, model, error } = await res.json();
  if (!res.ok) throw new Error(error ?? 'ขอ token ไม่สำเร็จ');

  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1beta' } });
  const player = new PcmPlayer();

  setStatus('กำลังต่อสาย...');
  // ประกาศก่อน connect เพราะ onmessage (setupComplete) อาจยิงมาก่อน connect() จะ resolve
  let session = null;
  session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: buildSystemInstruction(callerNumber),
      realtimeInputConfig: VAD_CONFIG,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: [REPORT_CALL_TOOL] }],
    },
    callbacks: {
      onopen: () => setStatus('ต่อสายแล้ว'),
      onmessage: (msg) => handleMessage(session, msg),
      onerror: (e) => setStatus(`ผิดพลาด: ${e.message ?? e}`),
      onclose: (e) => {
        setStatus(`วางสายแล้ว${e?.reason ? ` (${e.reason})` : ''}`);
        void endCall();
      },
    },
  });

  const guard = new CallGuard({
    isAiSpeaking: () => player.busy,
    onSilence: () => {
      setStatus(`ผู้โทรเงียบเกิน ${SILENCE_HANGUP_MS / 1000} วินาที · กำลังวางสาย`);
      sendSystemNote(session, 'ผู้โทรเงียบไปนาน ให้พูดประโยคนี้ประโยคเดียว "ถ้าไม่มีธุระ ดิฉันขออนุญาตวางสายนะคะ" ไม่ต้องเรียก report_call');
      renderSilentCall(callerNumber);
      endCallLater(GOODBYE_GRACE_MS);
    },
    onMaxDuration: () => {
      setStatus(`ครบ ${MAX_CALL_MS / 60000} นาที · กำลังวางสาย`);
      sendSystemNote(session, 'ครบเวลาสูงสุดของสายแล้ว ให้เรียก report_call ด้วยข้อมูลที่มีทันที แล้วพูดลาตาม action');
      endCallLater(MAX_DURATION_GRACE_MS);
    },
  });

  const targetRate = ui.phoneMode.checked ? PHONE_RATE : WIDEBAND_RATE;
  const mic = new MicStreamer({
    targetRate,
    onChunk: (data, mimeType) => session.sendRealtimeInput({ audio: { data, mimeType } }),
    onLevel: (peak) => {
      ui.level.value = peak;
      if (peak > CALLER_VOICE_LEVEL) guard.noteCallerActivity();
    },
  });
  await mic.start();

  call = { session, mic, player, callerNumber, guard };
  guard.start();
  // ให้ AI เปิดสายก่อน เหมือนตอนรับสายจริง
  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: '(มีสายเข้า ผู้โทรรออยู่)' }] }], turnComplete: true });

  ui.callBtn.textContent = 'วางสาย';
  ui.callBtn.disabled = false;
  setStatus(`คุยได้เลย · เสียงแบบ ${targetRate === PHONE_RATE ? 'สายโทรศัพท์ 8 kHz' : '16 kHz'}`);
}

// วางสายหลังให้เวลา AI พูดลา · ถ้าระหว่างนั้นเริ่มสายใหม่แล้ว ห้ามไปตัดสายใหม่
function endCallLater(ms) {
  const current = call;
  setTimeout(() => {
    if (call && call === current) void endCall();
  }, ms);
}

// ข้อความจากระบบ (ผู้โทรไม่ได้ยิน) สั่ง AI ให้ทำอะไรบางอย่างกลางสาย
function sendSystemNote(session, text) {
  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: `(ระบบ: ${text})` }] }], turnComplete: true });
}

// สายเงียบไม่ส่ง LINE ทุกครั้ง (รบกวนเกิน) แต่เก็บไว้รวมในสรุปรายวัน
function renderSilentCall(callerNumber) {
  const card = document.createElement('article');
  card.className = 'report silent';
  card.textContent = `สายเงียบ · เบอร์ ${callerNumber || '-'} · ผู้โทรไม่พูดเกิน ${
    SILENCE_HANGUP_MS / 1000
  } วินาที วางสายแล้ว · ไม่โอน ไม่แจ้ง LINE ทันที (เก็บไว้ในสรุปรายวัน)`;
  ui.reports.prepend(card);
}

async function endCall() {
  if (!call) return;
  const { session, mic, player, guard } = call;
  call = null;
  guard.stop();
  await mic.stop();
  await player.close();
  try {
    session.close();
  } catch {
    // ปิดไปแล้ว
  }
  ui.callBtn.textContent = 'รับสาย (เริ่มทดสอบ)';
  ui.callBtn.disabled = false;
}

ui.callBtn.addEventListener('click', async () => {
  try {
    if (call) await endCall();
    else await startCall();
  } catch (err) {
    console.error(err);
    setStatus(`ผิดพลาด: ${err.message}`);
    await endCall();
    ui.callBtn.disabled = false;
  }
});

// แสดงบททดสอบ · กดที่บทเพื่อใส่เบอร์ผู้โทรของบทนั้นให้อัตโนมัติ
const EXPECTED_LABEL = { end: 'ควรได้: จบสาย แจ้ง LINE', transfer: 'ควรได้: โอนสายให้ยาย' };
let lastGroup = '';
for (const s of TEST_SCRIPTS) {
  if (s.group !== lastGroup) {
    const h = document.createElement('li');
    h.className = 'group';
    h.textContent = s.group;
    ui.scripts.append(h);
    lastGroup = s.group;
  }
  const li = document.createElement('li');
  li.className = 'script';
  li.innerHTML = '<b></b><div class="meta"></div>';
  li.querySelector('b').textContent = s.title;
  li.querySelector('.meta').textContent = `เบอร์ ${s.callerNumber} · ${EXPECTED_LABEL[s.expected]}`;
  for (const line of s.lines) {
    const p = document.createElement('p');
    p.textContent = line;
    li.append(p);
  }
  li.addEventListener('click', () => {
    if (call) return; // ระหว่างคุยห้ามเปลี่ยนเบอร์
    ui.callerNumber.value = s.callerNumber;
    document.querySelectorAll('.script.picked').forEach((x) => x.classList.remove('picked'));
    li.classList.add('picked');
  });
  ui.scripts.append(li);
}
