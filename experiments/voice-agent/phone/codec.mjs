// แปลงเสียงระหว่าง Twilio (G.711 μ-law 8 kHz) กับ Gemini Live (PCM16 little-endian)

const BIAS = 0x84;
const CLIP = 32635;

function muLawDecodeSample(u) {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  return sign ? -sample : sample;
}

function muLawEncodeSample(sample) {
  const sign = sample < 0 ? 0x80 : 0;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// Twilio → Gemini: μ-law bytes → PCM16 (ยังเป็น 8 kHz · Gemini รับ rate=8000 ได้)
export function muLawToPcm16(muLaw) {
  const out = Buffer.alloc(muLaw.length * 2);
  for (let i = 0; i < muLaw.length; i++) out.writeInt16LE(muLawDecodeSample(muLaw[i]), i * 2);
  return out;
}

// Gemini → Twilio: PCM16 24 kHz → ลดเหลือ 8 kHz (เฉลี่ยทีละ 3 ตัว) → μ-law
export function pcm24kToMuLaw8k(pcm) {
  const samples = Math.floor(pcm.length / 2);
  const outLength = Math.floor(samples / 3);
  const out = Buffer.alloc(outLength);
  for (let i = 0; i < outLength; i++) {
    const a = pcm.readInt16LE(i * 6);
    const b = pcm.readInt16LE(i * 6 + 2);
    const c = pcm.readInt16LE(i * 6 + 4);
    out[i] = muLawEncodeSample(Math.round((a + b + c) / 3));
  }
  return out;
}

// ความดังสูงสุดของท่อนเสียง μ-law (0..32767) ใช้เช็กว่าผู้โทรกำลังพูดไหม
export function muLawPeak(muLaw) {
  let peak = 0;
  for (let i = 0; i < muLaw.length; i++) peak = Math.max(peak, Math.abs(muLawDecodeSample(muLaw[i])));
  return peak;
}
