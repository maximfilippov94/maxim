/** Bounded PCM capture. Uses actual hardware rate, not the requested rate.
 * Float32 microphone buffers stay in memory until explicit send or dismissal. */
export class VoicePCM {
  private chunks: Float32Array[] = [];
  private frames = 0;
  private rate = 0;
  readonly maxSeconds = 24;
  get seconds() { return this.rate ? this.frames / this.rate : 0; }
  clear() { this.chunks = []; this.frames = 0; this.rate = 0; }
  push(data: ArrayBuffer, sampleRate: number, channels: number): number {
    if (![1, 2].includes(channels) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || data.byteLength % (4 * channels)) {
      throw new Error('Микрофон вернул неподдерживаемый формат. Попробуйте ещё раз.');
    }
    if (this.rate && this.rate !== sampleRate) throw new Error('Изменился аудиовход. Повторите запись.');
    this.rate = sampleRate;
    const src = new Float32Array(data);
    const count = Math.min(src.length / channels, Math.max(0, Math.floor(sampleRate * this.maxSeconds) - this.frames));
    if (!count) return 0;
    const mono = new Float32Array(count);
    let sum = 0;
    for (let i = 0; i < count; i++) {
      let value = 0;
      for (let c = 0; c < channels; c++) value += src[i * channels + c];
      value /= channels;
      value = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      mono[i] = value; sum += value * value;
    }
    this.chunks.push(mono); this.frames += count;
    return Math.min(1, Math.sqrt(Math.max(0, Math.sqrt(sum / count) - .012)) * 2.8);
  }
  encode(): Uint8Array {
    if (this.seconds < .2) throw new Error('Запись слишком короткая. Скажите, что вы съели.');
    const input = new Float32Array(this.frames);
    let offset = 0;
    for (const chunk of this.chunks) { input.set(chunk, offset); offset += chunk.length; }
    const count = Math.floor(this.frames * 16000 / this.rate);
    const bytes = new Uint8Array(count * 2), out = new DataView(bytes.buffer);
    // Area average retains fractional coverage at 44.1/48 kHz and chunk boundaries.
    const ratio = this.rate / 16000;
    for (let i = 0; i < count; i++) {
      const start = i * ratio, end = Math.min(input.length, (i + 1) * ratio);
      let sum = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        sum += input[j] * (Math.min(j + 1, end) - Math.max(j, start));
      }
      const sample = Math.max(-1, Math.min(1, sum / (end - start)));
      out.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    return bytes;
  }
}
