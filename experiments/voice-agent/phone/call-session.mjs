// 1 สายโทรจริง = 1 PhoneCall
// Twilio media stream (μ-law 8 kHz) ⇄ Gemini Live · AI จับสัญญาณ → risk.js คิดคะแนน
// → ส่ง LINE ทันที → AI พูดลาหรือพูดประโยคโอนสาย → Twilio โอนสายไปมือถือยาย หรือวางสาย

import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { REPORT_CALL_TOOL, VOICE_NAME, buildFamilyMessage, buildSystemInstruction } from '../public/agent-config.js';
import { scoreCall } from '../public/risk.js';
import { muLawPeak, muLawToPcm16, pcm24kToMuLaw8k } from './codec.mjs';
import { broadcastLine } from './line.mjs';
import { dialTwiml, hangupTwiml, updateCall } from './twilio.mjs';

const SILENCE_HANGUP_MS = 8_000; // ผู้โทรเงียบเกินนี้ (ไม่นับตอน AI พูด) → AI ลาแล้ววาง
const MAX_CALL_MS = 3 * 60 * 1000;
const GOODBYE_FALLBACK_MS = 10_000; // ถ้า AI ไม่พูดลาภายในเวลานี้ ให้จบสายเลย
const CALLER_VOICE_PEAK = 2500; // ระดับเสียง μ-law (เต็ม 32767) ที่ถือว่าผู้โทรกำลังพูด
const TICK_MS = 500;
const GOODBYE_MARK = 'goodbye';

const VAD_CONFIG = {
  automaticActivityDetection: {
    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
    prefixPaddingMs: 100,
    silenceDurationMs: 500,
  },
};

function lineText(report, result, from) {
  const reasons = result.reasons.map((r) => `${r.weight > 0 ? '+' : ''}${r.weight} ${r.label}`).join('\n');
  return [
    buildFamilyMessage(report, result),
    '',
    `เบอร์ที่โทรเข้า: ${from || '-'}`,
    `คะแนนเสี่ยง: ${result.score}/100`,
    reasons ? `ที่มาของคะแนน:\n${reasons}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export class PhoneCall {
  constructor({ ws, config, isKnownCall }) {
    this.ws = ws;
    this.cfg = config;
    this.isKnownCall = isKnownCall;
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { apiVersion: 'v1beta' } });
    this.session = null;
    this.action = null; // 'transfer' | 'end' หลังได้ผลคะแนน หรือ 'end' ตอนสายเงียบ / ครบเวลา
    this.audioAfterAction = false;
    this.finished = false;
    this.closed = false;
    this.aiSpeakingUntil = 0;
    this.lastCallerActivity = Date.now();
    ws.on('message', (raw) => this.#onTwilio(raw).catch((e) => this.#log('error', e.message)));
    ws.on('close', () => this.close('stream closed'));
  }

  #log(...args) {
    console.log(`[${this.callSid?.slice(-6) ?? 'call'}]`, ...args);
  }

  #sendToTwilio(obj) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }

  async #onTwilio(raw) {
    const msg = JSON.parse(raw);
    if (msg.event === 'start') await this.#start(msg.start);
    else if (msg.event === 'media') this.#onCallerAudio(msg.media.payload);
    else if (msg.event === 'mark' && msg.mark?.name === GOODBYE_MARK) await this.#finish();
    else if (msg.event === 'stop') this.close('caller hung up');
  }

  async #start(start) {
    this.streamSid = start.streamSid;
    this.callSid = start.callSid;
    this.from = start.customParameters?.from ?? '';
    // รับเฉพาะ stream ที่มาจากสายที่ผ่านการตรวจลายเซ็น webhook แล้ว
    if (!this.isKnownCall(this.callSid)) {
      this.#log('ปฏิเสธ stream ที่ไม่รู้จัก');
      this.ws.close();
      return;
    }
    this.#log('สายเข้า จาก', this.from);

    this.session = await this.ai.live.connect({
      model: this.cfg.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: buildSystemInstruction(this.from),
        realtimeInputConfig: VAD_CONFIG,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [REPORT_CALL_TOOL] }],
      },
      callbacks: {
        onmessage: (m) => this.#onGemini(m).catch((e) => this.#log('error', e.message)),
        onerror: (e) => this.#log('gemini error', e.message),
        onclose: () => this.#log('gemini closed'),
      },
    });
    if (this.closed) return this.session.close();

    this.#systemNote('มีสายเข้า ผู้โทรรออยู่');
    this.lastCallerActivity = Date.now();
    this.tick = setInterval(() => this.#checkSilence(), TICK_MS);
    this.maxTimer = setTimeout(() => this.#onMaxDuration(), MAX_CALL_MS);
  }

  #systemNote(text) {
    this.session?.sendClientContent({ turns: [{ role: 'user', parts: [{ text: `(ระบบ: ${text})` }] }], turnComplete: true });
  }

  #onCallerAudio(payload) {
    const muLaw = Buffer.from(payload, 'base64');
    if (muLawPeak(muLaw) > CALLER_VOICE_PEAK) this.lastCallerActivity = Date.now();
    if (!this.session || this.finished) return;
    this.session.sendRealtimeInput({ audio: { data: muLawToPcm16(muLaw).toString('base64'), mimeType: 'audio/pcm;rate=8000' } });
  }

  async #onGemini(m) {
    if (m.toolCall) await this.#onToolCall(m.toolCall);
    const sc = m.serverContent;
    if (!sc) return;

    if (sc.inputTranscription?.text) {
      this.lastCallerActivity = Date.now();
      this.#log('ผู้โทร:', sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) this.#log('AI:', sc.outputTranscription.text);
    if (sc.interrupted) {
      this.#sendToTwilio({ event: 'clear', streamSid: this.streamSid });
      this.aiSpeakingUntil = Date.now();
    }

    for (const part of sc.modelTurn?.parts ?? []) {
      if (!part.inlineData?.data) continue;
      const muLaw = pcm24kToMuLaw8k(Buffer.from(part.inlineData.data, 'base64'));
      this.#sendToTwilio({ event: 'media', streamSid: this.streamSid, media: { payload: muLaw.toString('base64') } });
      this.aiSpeakingUntil = Math.max(Date.now(), this.aiSpeakingUntil) + (muLaw.length / 8000) * 1000;
      if (this.action) this.audioAfterAction = true;
    }

    // AI พูดประโยคลา/โอนสายจบแล้ว → วาง mark · Twilio จะส่ง mark กลับเมื่อเล่นเสียงถึงจุดนี้จริง
    if (sc.turnComplete && this.action && this.audioAfterAction && !this.goodbyeMarked) {
      this.goodbyeMarked = true;
      this.#sendToTwilio({ event: 'mark', streamSid: this.streamSid, mark: { name: GOODBYE_MARK } });
    }
  }

  async #onToolCall(toolCall) {
    const responses = [];
    for (const fc of toolCall.functionCalls ?? []) {
      if (fc.name !== REPORT_CALL_TOOL.name || this.report) {
        responses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
        continue;
      }
      this.report = fc.args ?? {};
      this.result = scoreCall(this.report.signals, this.report.evidence, this.from);
      this.#log('ผล:', this.result.verdict, this.result.score, '→', this.result.action);
      responses.push({ id: fc.id, name: fc.name, response: { action: this.result.action } });
      this.#setAction(this.result.action);
      broadcastLine(this.cfg.lineToken, lineText(this.report, this.result, this.from)).catch((e) =>
        this.#log('ส่ง LINE ไม่สำเร็จ:', e.message),
      );
    }
    this.session.sendToolResponse({ functionResponses: responses });
  }

  #setAction(action) {
    if (this.action) return;
    this.action = action;
    this.fallback = setTimeout(() => void this.#finish(), GOODBYE_FALLBACK_MS);
  }

  #checkSilence() {
    if (this.action || this.closed) return;
    if (Date.now() < this.aiSpeakingUntil) {
      this.lastCallerActivity = Date.now();
      return;
    }
    if (Date.now() - this.lastCallerActivity > SILENCE_HANGUP_MS) {
      this.#log('สายเงียบ → วางสาย (ไม่แจ้ง LINE)');
      this.silent = true;
      this.#systemNote('ผู้โทรเงียบไปนาน ให้พูดประโยคนี้ประโยคเดียว "ถ้าไม่มีธุระ ดิฉันขออนุญาตวางสายนะคะ" ไม่ต้องเรียก report_call');
      this.#setAction('end');
    }
  }

  #onMaxDuration() {
    if (this.action) return;
    this.#log('ครบเวลาสูงสุด');
    this.#systemNote('ครบเวลาสูงสุดของสายแล้ว ให้เรียก report_call ด้วยข้อมูลที่มีทันที แล้วพูดลาตาม action');
    setTimeout(() => this.#setAction('end'), GOODBYE_FALLBACK_MS);
  }

  // โอนสายไปมือถือยาย หรือวางสาย · เปลี่ยน TwiML ของสาย (stream นี้จะถูกตัดเอง)
  async #finish() {
    if (this.finished) return;
    this.finished = true;
    clearTimeout(this.fallback);
    const transfer = this.action === 'transfer' && this.cfg.elderPhone;
    const twiml = transfer ? dialTwiml(this.cfg.elderPhone, this.cfg.twilioNumber) : hangupTwiml();
    this.#log(transfer ? `โอนสายไป ${this.cfg.elderPhone}` : 'วางสาย');
    try {
      await updateCall({ accountSid: this.cfg.twilioSid, authToken: this.cfg.twilioToken, callSid: this.callSid, twiml });
    } catch (e) {
      this.#log('สั่ง Twilio ไม่สำเร็จ:', e.message);
    }
    this.close('finished');
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.tick);
    clearTimeout(this.maxTimer);
    clearTimeout(this.fallback);
    if (!this.report && !this.silent) this.#log('ผู้โทรวางก่อน AI สรุป (ไม่แจ้ง LINE)');
    try {
      this.session?.close();
    } catch {
      // ปิดไปแล้ว
    }
    this.#log('จบสาย:', reason);
  }
}
