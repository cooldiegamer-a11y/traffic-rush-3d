class RacingAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private engineRunning = false;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopEngine();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public startEngine() {
    if (this.muted || this.engineRunning) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(58, ctx.currentTime);
    osc2.frequency.setValueAtTime(116, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 0.25);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.oscPrimary = osc1;
    this.oscHarmonic = osc2;
    this.engineFilter = filter;
    this.engineGain = gain;
    this.engineRunning = true;
  }

  public updateEngine(speedKmh: number, isNitro: boolean, isBraking: boolean) {
    if (this.muted) {
      this.stopEngine();
      return;
    }
    if (!this.engineRunning || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.engineFilter || !this.engineGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const normalized = Math.max(0, Math.min(1.4, (speedKmh - 55) / 220));
    const baseFreq = 52 + normalized * 88 + (isNitro ? 34 : 0) - (isBraking ? 10 : 0);
    const cutoff = 220 + normalized * 520 + (isNitro ? 380 : 0);
    const targetVol = isBraking ? 0.038 : isNitro ? 0.075 : 0.055;

    this.oscPrimary.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.oscHarmonic.frequency.setTargetAtTime(baseFreq * 1.99, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
  }

  public stopEngine() {
    if (!this.engineRunning) return;
    const ctx = this.ctx;
    try {
      if (ctx && this.engineGain) {
        const now = ctx.currentTime;
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
      }
      const o1 = this.oscPrimary;
      const o2 = this.oscHarmonic;
      window.setTimeout(() => {
        try {
          o1?.stop();
          o2?.stop();
          o1?.disconnect();
          o2?.disconnect();
        } catch {
          // ignore
        }
      }, 120);
    } catch {
      // ignore
    }
    this.oscPrimary = null;
    this.oscHarmonic = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.engineRunning = false;
  }

  public playCoin() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [987.77, 1318.51]; // B5 -> E6 crisp arcade coin chime
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  public playOvertake(isNearMiss: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isNearMiss ? 520 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(isNearMiss ? 780 : 490, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isNearMiss ? 0.08 : 0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playNitroBurst() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playCrash() {
    this.stopEngine();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sub-bass impact thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(135, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.42);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.46);

    // 2. White-noise metallic crunch burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }
}

export const racingAudio = new RacingAudioEngine();
