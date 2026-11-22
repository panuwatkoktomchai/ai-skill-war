// ตัวคุมสาย: กันเปลืองค่า AI จากสายเงียบและสายที่ลากยาว
// - ผู้โทรไม่พูดเกิน SILENCE_HANGUP_MS (นับหลัง AI พูดจบ) → onSilence
// - สายยาวเกิน MAX_CALL_MS → onMaxDuration
// เสียงขาเข้าคิดเงินตลอดที่ต่อสาย ถึงจะเงียบก็ตาม จึงต้องมีตัวนี้

export const SILENCE_HANGUP_MS = 8_000;
export const MAX_CALL_MS = 3 * 60 * 1000;
const TICK_MS = 500;

export class CallGuard {
  constructor({ isAiSpeaking, onSilence, onMaxDuration }) {
    this.isAiSpeaking = isAiSpeaking;
    this.onSilence = onSilence;
    this.onMaxDuration = onMaxDuration;
    this.fired = null;
  }

  start() {
    this.lastActivityAt = performance.now();
    this.tickTimer = setInterval(() => this.#tick(), TICK_MS);
    this.maxTimer = setTimeout(() => this.#fire('max'), MAX_CALL_MS);
  }

  // เรียกเมื่อผู้โทรพูด (ได้ข้อความถอดเสียง หรือเสียงไมค์ดังพอ)
  noteCallerActivity() {
    this.lastActivityAt = performance.now();
  }

  #tick() {
    if (this.fired) return;
    // ระหว่าง AI พูดไม่นับเป็นความเงียบของผู้โทร
    if (this.isAiSpeaking()) {
      this.lastActivityAt = performance.now();
      return;
    }
    if (performance.now() - this.lastActivityAt > SILENCE_HANGUP_MS) this.#fire('silence');
  }

  #fire(kind) {
    if (this.fired) return;
    this.fired = kind;
    if (kind === 'silence') this.onSilence();
    else this.onMaxDuration();
  }

  stop() {
    clearInterval(this.tickTimer);
    clearTimeout(this.maxTimer);
  }
}
