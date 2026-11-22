import { GoogleGenAI, Modality } from '@google/genai';
import { MicStreamer, PcmPlayer } from '/audio.js';
import { REPORT_CALL_TOOL, SYSTEM_INSTRUCTION, TEST_SCRIPTS, VOICE_NAME } from '/agent-config.js';

const PHONE_RATE = 8000;
const WIDEBAND_RATE = 16000;

const $ = (id) => document.getElementById(id);
const ui = {
  callBtn: $('call-btn'),
  status: $('status'),
  phoneMode: $('phone-mode'),
  level: $('level'),
  latency: $('latency'),
  transcript: $('transcript'),
  report: $('report'),
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

function renderReport(r) {
  const v = VERDICT_LABEL[r.verdict] ?? VERDICT_LABEL.suspicious;
  ui.report.className = `report ${v.cls}`;
  ui.report.innerHTML = `
    <div class="line-head">LINE ถึงคุณแดงและลูกหลาน</div>
    <p class="line-msg"></p>
    <dl>
      <dt>ผลประเมิน</dt><dd>${v.text} · ความเสี่ยง ${Number(r.scam_risk) || 0}/100</dd>
      <dt>ผู้โทร</dt><dd class="f-name"></dd>
      <dt>อ้างว่าเป็น</dt><dd class="f-org"></dd>
      <dt>ธุระ</dt><dd class="f-purpose"></dd>
      <dt>เบอร์กลับ</dt><dd class="f-cb"></dd>
      <dt>สัญญาณอันตราย</dt><dd class="f-flags"></dd>
    </dl>`;
  ui.report.querySelector('.line-msg').textContent = r.message_to_family ?? '';
  ui.report.querySelector('.f-name').textContent = r.caller_name ?? '-';
  ui.report.querySelector('.f-org').textContent = r.claimed_organization ?? '-';
  ui.report.querySelector('.f-purpose').textContent = r.purpose ?? '-';
  ui.report.querySelector('.f-cb').textContent = r.callback_number ?? '-';
  ui.report.querySelector('.f-flags').textContent = (r.red_flags ?? []).join(' · ') || '-';
  ui.report.hidden = false;
}

function handleToolCall(session, toolCall) {
  const responses = [];
  for (const fc of toolCall.functionCalls ?? []) {
    if (fc.name === REPORT_CALL_TOOL.name) {
      renderReport(fc.args ?? {});
      console.log('report_call', fc.args);
    }
    responses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
  }
  session.sendToolResponse({ functionResponses: responses });
}

function handleMessage(session, msg) {
  if (msg.toolCall) handleToolCall(session, msg.toolCall);

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
  ui.report.hidden = true;
  ui.latency.textContent = '-';
  setStatus('กำลังขอ token...');

  const res = await fetch('/api/session', { method: 'POST' });
  const { token, model, error } = await res.json();
  if (!res.ok) throw new Error(error ?? 'ขอ token ไม่สำเร็จ');

  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1beta' } });
  const player = new PcmPlayer();

  setStatus('กำลังต่อสาย...');
  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_INSTRUCTION,
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

  call = { session, mic, player };
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
