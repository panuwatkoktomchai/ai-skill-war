import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { MicStreamer, PcmPlayer } from '/audio.js';
import {
  REPORT_CALL_TOOL,
  TEST_SCRIPTS,
  VOICE_NAME,
  buildSystemInstruction,
  decideCallAction,
} from '/agent-config.js';

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
function renderReport(r, callerNumber) {
  const v = VERDICT_LABEL[r.verdict] ?? VERDICT_LABEL.suspicious;
  const card = document.createElement('article');
  card.className = `report ${v.cls}`;
  card.innerHTML = `
    <div class="line-head">LINE ถึงคุณแดงและลูกหลาน · <span class="f-time"></span></div>
    <p class="line-msg"></p>
    <dl>
      <dt>ผลประเมิน</dt><dd>${v.text} · ความเสี่ยง ${Number(r.scam_risk) || 0}/100</dd>
      <dt>เบอร์ที่โทรเข้า</dt><dd class="f-in"></dd>
      <dt>ผู้โทร</dt><dd class="f-name"></dd>
      <dt>อ้างว่าเป็น</dt><dd class="f-org"></dd>
      <dt>ธุระ</dt><dd class="f-purpose"></dd>
      <dt>เบอร์กลับ</dt><dd class="f-cb"></dd>
      <dt>สัญญาณอันตราย</dt><dd class="f-flags"></dd>
    </dl>`;
  const set = (cls, text) => (card.querySelector(cls).textContent = text);
  set('.f-time', new Date().toLocaleTimeString('th-TH'));
  set('.line-msg', r.message_to_family ?? '');
  set('.f-in', callerNumber || '-');
  set('.f-name', r.caller_name ?? '-');
  set('.f-org', r.claimed_organization ?? '-');
  set('.f-purpose', r.purpose ?? '-');
  set('.f-cb', r.callback_number ?? '-');
  set('.f-flags', (r.red_flags ?? []).join(' · ') || '-');
  ui.reports.prepend(card);
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
      const action = decideCallAction(report);
      renderReport(report, call?.callerNumber);
      if (action === 'transfer') showTransfer(report);
      response = { action };
      console.log('report_call', action, report);
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

  const targetRate = ui.phoneMode.checked ? PHONE_RATE : WIDEBAND_RATE;
  const mic = new MicStreamer({
    targetRate,
    onChunk: (data, mimeType) => session.sendRealtimeInput({ audio: { data, mimeType } }),
    onLevel: (peak) => (ui.level.value = peak),
  });
  await mic.start();

  call = { session, mic, player, callerNumber };
  // ให้ AI เปิดสายก่อน เหมือนตอนรับสายจริง
  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: '(มีสายเข้า ผู้โทรรออยู่)' }] }], turnComplete: true });

  ui.callBtn.textContent = 'วางสาย';
  ui.callBtn.disabled = false;
  setStatus(`คุยได้เลย · เสียงแบบ ${targetRate === PHONE_RATE ? 'สายโทรศัพท์ 8 kHz' : '16 kHz'}`);
}

async function endCall() {
  if (!call) return;
  const { session, mic, player } = call;
  call = null;
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

for (const s of TEST_SCRIPTS) {
  const li = document.createElement('li');
  li.innerHTML = '<b></b><span></span>';
  li.querySelector('b').textContent = s.title;
  li.querySelector('span').textContent = s.lines;
  ui.scripts.append(li);
}
