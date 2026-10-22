/** Display-only snapshots. Never supplies text to final food parsing. */
export class VoicePreview {
  private version = 0;
  private seq = 0;
  private busy = false;
  private disabled = false;
  private controller: AbortController | null = null;
  private key = '';
  constructor(private send: (bytes: Uint8Array, key: string, seq: number, signal: AbortSignal) => Promise<string>, private receive: (text: string) => void) {}
  begin(key: string) { this.cancel(); this.key = key; this.seq = 0; this.disabled = false; }
  cancel() { ++this.version; this.controller?.abort(); this.controller = null; this.busy = false; }
  tick(seconds: number, encode: () => Uint8Array, enabled: boolean) {
    const seq = Math.min(3, Math.floor(seconds / 6));
    if (!enabled || this.disabled || this.busy || seq <= this.seq || seq < 1 || seconds > 24) return;
    const version = this.version, ctl = new AbortController();
    this.controller = ctl; this.busy = true; this.seq = seq;
    Promise.resolve().then(() => { if (version !== this.version) return ''; return this.send(encode(), this.key, seq, ctl.signal); })
      .then(text => { if (version === this.version && !ctl.signal.aborted && text.trim()) this.receive(text.trim().slice(0, 2500)); })
      .catch(() => { if (version === this.version) this.disabled = true; })
      .finally(() => { if (version === this.version) { this.busy = false; this.controller = null; } });
  }
}
