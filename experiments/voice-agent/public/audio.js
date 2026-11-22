// เครื่องมือเสียงฝั่งเบราว์เซอร์: อัดไมค์เป็น PCM16 และเล่นเสียง PCM16 ที่ได้จาก Gemini

const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live ส่งเสียงออกที่ 24 kHz เสมอ
const CHUNK_MS = 40;

function floatTo16BitPcm(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// ลด sample rate แบบเฉลี่ยช่วง ใช้จำลองเสียงสายโทรศัพท์ (8 kHz) หรือส่ง 16 kHz ตามที่ API แนะนำ
function downsample(samples, fromRate, toRate) {
  if (toRate >= fromRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export class MicStreamer {
  constructor({ targetRate, onChunk, onLevel }) {
    this.targetRate = targetRate;
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.pending = [];
    this.pendingLength = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule('/pcm-worklet.js');
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
    this.node.port.onmessage = (e) => this.#collect(e.data);
    source.connect(this.node);
  }

  #collect(block) {
    this.pending.push(block);
    this.pendingLength += block.length;
    const needed = (this.ctx.sampleRate * CHUNK_MS) / 1000;
    if (this.pendingLength < needed) return;

    const merged = new Float32Array(this.pendingLength);
    let offset = 0;
    for (const b of this.pending) {
      merged.set(b, offset);
      offset += b.length;
    }
    this.pending = [];
    this.pendingLength = 0;

    let peak = 0;
    for (const s of merged) peak = Math.max(peak, Math.abs(s));
    this.onLevel?.(peak);

    const pcm = floatTo16BitPcm(downsample(merged, this.ctx.sampleRate, this.targetRate));
    this.onChunk(bytesToBase64(new Uint8Array(pcm.buffer)), `audio/pcm;rate=${this.targetRate}`);
  }

  async stop() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
  }
}

export class PcmPlayer {
  constructor() {
    this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.nextTime = 0;
    this.sources = new Set();
  }

  play(base64) {
    const pcm = base64ToInt16(base64);
    const buffer = this.ctx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime);
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  // ผู้โทรพูดแทรก: หยุดเสียง AI ที่ค้างคิวทันที
  interrupt() {
    for (const s of this.sources) s.stop();
    this.sources.clear();
    this.nextTime = 0;
  }

  async close() {
    this.interrupt();
    await this.ctx.close();
  }
}
