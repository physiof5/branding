// ─────────────────────────────────────────────────────────────
// 사운드 시스템
//  - 기본: Web Audio API 로 효과음/BGM 을 실시간 합성 (에셋 0개로 바로 동작)
//  - 확장: sound.register('hit', '/sfx/hit.mp3') 처럼 파일을 등록하면 그 효과음은 파일로 재생
// ─────────────────────────────────────────────────────────────

export type SfxName =
  | 'ui'
  | 'lock'
  | 'tick'
  | 'tickFinal'
  | 'ready'
  | 'fight'
  | 'reveal'
  | 'charge'
  | 'chargeDone'
  | 'dodge'
  | 'swing'
  | 'hit'
  | 'powerHit'
  | 'specialRise'
  | 'specialBoom'
  | 'clash'
  | 'shield'
  | 'shieldBreak'
  | 'jam'
  | 'whiff'
  | 'ko'
  | 'win'
  | 'lose'
  | 'buy'
  | 'claim'
  | 'wiggle';

export type BgmTrack = 'battle' | 'lobby';

interface Volumes {
  master: number;
  sfx: number;
  bgm: number;
  muted: boolean;
}

type Ctx = AudioContext;

const NOTE = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private shaper: WaveShaperNode | null = null;
  private overrides = new Map<string, AudioBuffer>();
  private overrideUrls = new Map<string, string>();
  private volumes: Volumes = { master: 0.8, sfx: 0.9, bgm: 0.45, muted: false };

  private bgmTrack: BgmTrack | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
  private nextNoteTime = 0;
  private intensity = 0;

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** 사용자 제스처(클릭/키) 안에서 호출해야 소리가 난다 */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.bgmBus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      this.sfxBus.connect(this.master);
      this.bgmBus.connect(this.master);
      this.master.connect(comp).connect(ctx.destination);
      this.noise = this.makeNoise(ctx);
      this.shaper = ctx.createWaveShaper();
      this.shaper.curve = this.makeDistortion(40);
      this.applyVolumes();
      for (const [name, url] of this.overrideUrls) void this.loadOverride(name, url);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.bgmTrack && !this.bgmTimer) this.startScheduler();
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  /** 효과음을 오디오 파일로 교체 */
  register(name: SfxName, url: string): void {
    this.overrideUrls.set(name, url);
    if (this.ctx) void this.loadOverride(name, url);
  }

  play(name: SfxName, opts: { gain?: number; rate?: number } = {}): void {
    const ctx = this.ctx;
    const out = this.sfxBus;
    if (!ctx || !out || ctx.state !== 'running') return;
    const buf = this.overrides.get(name);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      const g = ctx.createGain();
      g.gain.value = opts.gain ?? 1;
      src.connect(g).connect(out);
      src.start();
      return;
    }
    const dest = ctx.createGain();
    dest.gain.value = opts.gain ?? 1;
    dest.connect(out);
    this.synth(name, ctx, dest, ctx.currentTime + 0.005);
  }

  // ── BGM ────────────────────────────────────────────────────
  startBgm(track: BgmTrack): void {
    if (this.bgmTrack === track && this.bgmTimer) return;
    this.bgmTrack = track;
    this.bgmStep = 0;
    this.intensity = 0;
    if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.08;
    if (this.unlocked) this.startScheduler();
  }

  stopBgm(): void {
    this.bgmTrack = null;
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  /** 0 평상시 / 1 긴장(마지막 1초) / 2 위기(필살기 직전·저체력) — 템포와 편성이 올라간다 */
  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(2, level));
  }

  // ── 내부 ───────────────────────────────────────────────────
  private applyVolumes(): void {
    if (!this.master || !this.sfxBus || !this.bgmBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.bgmBus.gain.setTargetAtTime(this.volumes.bgm * 0.55, t, 0.05);
  }

  private async loadOverride(name: string, url: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      this.overrides.set(name, await this.ctx.decodeAudioData(data));
    } catch {
      /* 파일이 없으면 합성음으로 폴백 */
    }
  }

  private startScheduler(): void {
    if (!this.ctx || this.bgmTimer) return;
    this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05);
    this.bgmTimer = setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmTrack || !this.bgmBus) return;
    if (ctx.state !== 'running') return;
    // 탭이 오래 멈췄다면 따라잡지 말고 현재로 점프
    if (this.nextNoteTime < ctx.currentTime - 0.3) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      const bpm = this.bgmTrack === 'battle' ? 126 + this.intensity * 12 : 96;
      const stepDur = 60 / bpm / 4;
      if (this.bgmTrack === 'battle') this.battleStep(ctx, this.bgmBus, this.bgmStep, this.nextNoteTime, stepDur);
      else this.lobbyStep(ctx, this.bgmBus, this.bgmStep, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.bgmStep = (this.bgmStep + 1) % 64;
    }
  }

  private battleStep(ctx: Ctx, out: GainNode, step: number, t: number, sd: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const hot = this.intensity;
    // 킥
    if (s % 4 === 0 || (hot >= 2 && s === 14)) this.kick(ctx, out, t, 0.9);
    // 클랩
    if (s === 4 || s === 12) this.noiseHit(ctx, out, t, 0.09, 'bandpass', 1700, 0.35);
    // 하이햇
    if (s % 2 === 1 || hot >= 1) this.noiseHit(ctx, out, t, 0.025, 'highpass', 7500, s % 2 === 1 ? 0.12 : 0.06);
    // 베이스 (A 단조 리프)
    const roots = [45, 45, 48, 43];
    const bassLine = [0, null, 0, null, 12, null, 0, 3, 0, null, 0, null, 7, null, 5, 3];
    const off = bassLine[s];
    if (off !== null) this.tone(ctx, out, 'sawtooth', NOTE(roots[bar % 4] - 12 + off), t, sd * 0.9, 0.16, 500);
    // 리드 아르페지오 (긴장 상승 시)
    if (hot >= 1 && s % 2 === 0) {
      const arp = [0, 3, 7, 12, 15, 12, 7, 3];
      this.tone(ctx, out, 'square', NOTE(roots[bar % 4] + 24 + arp[(s / 2) % 8]), t, sd * 0.8, 0.045, 3200);
    }
    // 스탭 (마디 첫 박)
    if (s === 0) this.tone(ctx, out, 'triangle', NOTE(roots[bar % 4] + 12), t, sd * 3, 0.07, 1800);
  }

  private lobbyStep(ctx: Ctx, out: GainNode, step: number, t: number, sd: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chords = [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ];
    const ch = chords[bar];
    if (s % 2 === 0) {
      const n = ch[(s / 2) % 3] + (s >= 8 ? 12 : 0);
      this.tone(ctx, out, 'sine', NOTE(n), t, sd * 1.6, 0.09, 4000);
    }
    if (s === 0 || s === 8) this.tone(ctx, out, 'triangle', NOTE(ch[0] - 24), t, sd * 6, 0.12, 900);
    if (s % 4 === 2) this.noiseHit(ctx, out, t, 0.02, 'highpass', 8000, 0.05);
  }

  private makeNoise(ctx: Ctx): AudioBuffer {
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeDistortion(k: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // ── 합성 프리미티브 ─────────────────────────────────────────
  private env(ctx: Ctx, t: number, peak: number, attack: number, dur: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private tone(
    ctx: Ctx,
    out: AudioNode,
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    peak: number,
    lowpass = 8000,
    freqEnd?: number,
  ): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.env(ctx, t, peak, Math.min(0.01, dur / 4), dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseHit(
    ctx: Ctx,
    out: AudioNode,
    t: number,
    dur: number,
    type: BiquadFilterType,
    freq: number,
    peak: number,
    freqEnd?: number,
    q = 1,
  ): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + dur);
    const g = this.env(ctx, t, peak, Math.min(0.008, dur / 5), dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private kick(ctx: Ctx, out: AudioNode, t: number, peak: number): void {
    this.tone(ctx, out, 'sine', 150, t, 0.22, peak, 1200, 42);
  }

  private synth(name: SfxName, ctx: Ctx, out: GainNode, t: number): void {
    switch (name) {
      case 'ui':
        this.tone(ctx, out, 'square', 660, t, 0.05, 0.08, 2500);
        this.tone(ctx, out, 'square', 990, t + 0.035, 0.05, 0.06, 2500);
        break;
      case 'lock':
        this.tone(ctx, out, 'triangle', 520, t, 0.12, 0.3, 4000, 820);
        break;
      case 'tick':
        this.tone(ctx, out, 'square', 880, t, 0.07, 0.12, 3000);
        break;
      case 'tickFinal':
        this.tone(ctx, out, 'square', 1320, t, 0.1, 0.16, 3500);
        this.tone(ctx, out, 'sine', 660, t, 0.14, 0.2);
        break;
      case 'ready':
        this.tone(ctx, out, 'sawtooth', NOTE(69), t, 0.14, 0.12, 2000);
        this.tone(ctx, out, 'sawtooth', NOTE(76), t + 0.16, 0.22, 0.12, 2000);
        break;
      case 'fight':
        for (const n of [57, 61, 64, 69]) this.tone(ctx, out, 'sawtooth', NOTE(n), t, 0.45, 0.1, 2600);
        this.noiseHit(ctx, out, t, 0.25, 'lowpass', 4000, 0.4, 300);
        this.kick(ctx, out, t, 1);
        break;
      case 'reveal':
        this.tone(ctx, out, 'square', NOTE(76), t, 0.06, 0.1, 3000);
        this.tone(ctx, out, 'square', NOTE(83), t + 0.07, 0.12, 0.1, 3000);
        break;
      case 'charge': {
        const o = this.tone(ctx, out, 'sine', 220, t, 0.6, 0.28, 3000, 700);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 22;
        lg.gain.value = 40;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 0.65);
        this.tone(ctx, out, 'triangle', 660, t + 0.05, 0.5, 0.06, 6000, 1760);
        this.noiseHit(ctx, out, t, 0.6, 'bandpass', 900, 0.12, 3500, 2);
        break;
      }
      case 'chargeDone':
        this.tone(ctx, out, 'sine', NOTE(84), t, 0.12, 0.14);
        this.tone(ctx, out, 'sine', NOTE(88), t + 0.06, 0.16, 0.12);
        this.tone(ctx, out, 'sine', NOTE(91), t + 0.12, 0.22, 0.1);
        break;
      case 'dodge':
        this.noiseHit(ctx, out, t, 0.22, 'bandpass', 600, 0.55, 3600, 1.4);
        this.noiseHit(ctx, out, t + 0.16, 0.2, 'bandpass', 3200, 0.4, 700, 1.4);
        break;
      case 'swing':
        this.noiseHit(ctx, out, t, 0.2, 'bandpass', 350, 0.45, 1600, 1.2);
        break;
      case 'hit':
        this.tone(ctx, out, 'sine', 170, t, 0.22, 0.95, 1500, 45);
        this.noiseHit(ctx, out, t, 0.12, 'lowpass', 2400, 0.55, 300);
        this.noiseHit(ctx, out, t, 0.04, 'highpass', 3000, 0.4);
        break;
      case 'powerHit': {
        const shaped = ctx.createGain();
        shaped.gain.value = 0.7;
        if (this.shaper) {
          const sh = ctx.createWaveShaper();
          sh.curve = this.shaper.curve;
          shaped.connect(sh).connect(out);
        } else shaped.connect(out);
        this.tone(ctx, shaped, 'sine', 130, t, 0.4, 1, 1200, 32);
        this.tone(ctx, shaped, 'sawtooth', 90, t, 0.18, 0.4, 900, 40);
        this.noiseHit(ctx, out, t, 0.3, 'lowpass', 3000, 0.7, 200);
        this.noiseHit(ctx, out, t, 0.05, 'highpass', 2500, 0.5);
        break;
      }
      case 'specialRise':
        this.noiseHit(ctx, out, t, 1.3, 'highpass', 200, 0.35, 5000, 0.8);
        this.tone(ctx, out, 'sawtooth', 110, t, 1.3, 0.14, 2400, 880);
        this.tone(ctx, out, 'square', 55, t, 1.3, 0.12, 400, 110);
        break;
      case 'specialBoom': {
        const shaped = ctx.createGain();
        shaped.gain.value = 0.8;
        if (this.shaper) {
          const sh = ctx.createWaveShaper();
          sh.curve = this.shaper.curve;
          shaped.connect(sh).connect(out);
        } else shaped.connect(out);
        this.tone(ctx, shaped, 'sine', 80, t, 1.2, 1, 900, 24);
        this.noiseHit(ctx, out, t, 1.1, 'lowpass', 1500, 0.9, 70);
        this.noiseHit(ctx, out, t + 0.02, 1.2, 'highpass', 6000, 0.18);
        for (const n of [45, 52, 57]) this.tone(ctx, out, 'sawtooth', NOTE(n), t + 0.05, 1.1, 0.08, 1200);
        break;
      }
      case 'clash': {
        const o = this.tone(ctx, out, 'sine', 240, t, 0.7, 0.5, 2500, 160);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 13;
        lg.gain.setValueAtTime(130, t);
        lg.gain.exponentialRampToValueAtTime(1, t + 0.7);
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 0.75);
        this.kick(ctx, out, t, 0.8);
        break;
      }
      case 'shield':
        for (const f of [1240, 1860, 2480]) this.tone(ctx, out, 'sine', f, t, 0.7, 0.09, 9000);
        this.noiseHit(ctx, out, t, 0.05, 'highpass', 5000, 0.2);
        break;
      case 'shieldBreak':
        for (let i = 0; i < 5; i++) this.noiseHit(ctx, out, t + i * 0.035, 0.06, 'highpass', 4000 + i * 600, 0.25);
        this.tone(ctx, out, 'sine', 2100, t, 0.4, 0.12, 9000, 700);
        break;
      case 'jam':
        this.noiseHit(ctx, out, t, 0.22, 'lowpass', 700, 0.7, 150);
        this.tone(ctx, out, 'sine', 320, t, 0.16, 0.35, 2000, 110);
        for (let i = 0; i < 3; i++) this.tone(ctx, out, 'sine', 380 + i * 90, t + 0.12 + i * 0.07, 0.06, 0.12, 4000, 900);
        break;
      case 'whiff':
        this.noiseHit(ctx, out, t, 0.2, 'bandpass', 1900, 0.28, 600, 2);
        break;
      case 'ko':
        this.tone(ctx, out, 'triangle', 660, t, 0.9, 0.35, 3000, 110);
        this.tone(ctx, out, 'sine', 880, t + 0.05, 1.3, 0.16, 6000);
        this.kick(ctx, out, t, 1);
        break;
      case 'win':
        [72, 76, 79, 84].forEach((n, i) => this.tone(ctx, out, 'square', NOTE(n), t + i * 0.11, 0.12, 0.12, 3500));
        for (const n of [72, 76, 79, 84]) this.tone(ctx, out, 'triangle', NOTE(n), t + 0.48, 0.7, 0.1, 4000);
        break;
      case 'lose':
        [67, 66, 65, 60].forEach((n, i) => {
          const o = this.tone(ctx, out, 'sawtooth', NOTE(n), t + i * 0.32, i === 3 ? 0.8 : 0.3, 0.12, 1400);
          if (i === 3) {
            const lfo = ctx.createOscillator();
            const lg = ctx.createGain();
            lfo.frequency.value = 6;
            lg.gain.value = 6;
            lfo.connect(lg).connect(o.frequency);
            lfo.start(t + 0.96);
            lfo.stop(t + 1.8);
          }
        });
        break;
      case 'buy':
        this.tone(ctx, out, 'square', 988, t, 0.07, 0.12, 4000);
        this.tone(ctx, out, 'square', 1319, t + 0.07, 0.25, 0.12, 4000);
        break;
      case 'claim':
        [76, 79, 84, 88].forEach((n, i) => this.tone(ctx, out, 'triangle', NOTE(n), t + i * 0.07, 0.18, 0.14, 6000));
        break;
      case 'wiggle':
        this.tone(ctx, out, 'sine', 300, t, 0.12, 0.25, 3000, 520);
        this.tone(ctx, out, 'sine', 520, t + 0.12, 0.12, 0.25, 3000, 300);
        break;
    }
  }
}

export const sound = new SoundEngine();
