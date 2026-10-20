// Звуки, сгенерированные кодом (WebAudio, в духе sfxr). Ни одного чужого звукового файла.
type Wave = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  sfxVolume = 0.8;
  musicVolume = 0.5;
  vibration = true;
  private lastPlay = new Map<string, number>();

  /** Звук можно запустить только после первого касания — вызывается из обработчика тапа. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxVolume;
    this.musicBus.gain.value = this.musicVolume * 0.55;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone(o: { type?: Wave; f0: number; f1?: number; dur: number; vol?: number; at?: number; attack?: number; bus?: GainNode; curve?: 'exp' | 'lin'; detune?: number }) {
    const c = this.ctx;
    if (!c) return;
    const t = o.at ?? c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    }
    if (o.detune) osc.detune.value = o.detune;
    const v = (o.vol ?? 0.3);
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(o.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  noise(o: { dur: number; vol?: number; at?: number; type?: BiquadFilterType; f0?: number; f1?: number; q?: number; bus?: GainNode; attack?: number }) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = o.at ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.f0 ?? 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.02);
  }

  /** Не повторять один и тот же звук чаще, чем раз в minGap секунд. */
  private gate(name: string, minGap: number) {
    const t = this.now, last = this.lastPlay.get(name) ?? -1;
    if (t - last < minGap) return false;
    this.lastPlay.set(name, t);
    return true;
  }

  play(name: SfxName, o: { pitch?: number; vol?: number } = {}) {
    if (!this.ctx || this.sfxVolume <= 0) return;
    const p = o.pitch ?? 1, v = o.vol ?? 1;
    const T = this.now;
    switch (name) {
      case 'shoot_smile':
        if (!this.gate(name, 0.04)) return;
        this.tone({ type: 'square', f0: 520 * p, f1: 980 * p, dur: 0.09, vol: 0.12 * v });
        this.tone({ type: 'triangle', f0: 1040 * p, f1: 1500 * p, dur: 0.06, vol: 0.06 * v });
        break;
      case 'shoot_germ':
        if (!this.gate(name, 0.05)) return;
        this.noise({ dur: 0.16, vol: 0.22 * v, type: 'bandpass', f0: 2600 * p, f1: 700 * p, q: 1.2 });
        this.tone({ type: 'sine', f0: 240 * p, f1: 110 * p, dur: 0.12, vol: 0.16 * v });
        break;
      case 'shoot_robot':
        if (!this.gate(name, 0.05)) return;
        this.tone({ type: 'sawtooth', f0: 480 * p, f1: 180 * p, dur: 0.12, vol: 0.08 * v });
        break;
      case 'laser':
        this.tone({ type: 'sine', f0: 1900 * p, f1: 260 * p, dur: 0.18, vol: 0.14 * v });
        this.tone({ type: 'square', f0: 950 * p, f1: 130 * p, dur: 0.16, vol: 0.04 * v });
        break;
      case 'punch':
        this.noise({ dur: 0.12, vol: 0.3 * v, f0: 900, f1: 120 });
        this.tone({ type: 'sine', f0: 160, f1: 60, dur: 0.14, vol: 0.25 * v });
        break;
      case 'hit':
        if (!this.gate(name, 0.035)) return;
        this.noise({ dur: 0.06, vol: 0.16 * v, type: 'highpass', f0: 1800 });
        this.tone({ type: 'square', f0: 260 * p, f1: 140 * p, dur: 0.06, vol: 0.07 * v });
        break;
      case 'hurt':
        if (!this.gate(name, 0.08)) return;
        this.tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.16, vol: 0.13 * v });
        this.noise({ dur: 0.1, vol: 0.12 * v, f0: 700 });
        break;
      case 'death':
        this.tone({ type: 'square', f0: 520 * p, f1: 70 * p, dur: 0.55, vol: 0.12 * v });
        this.noise({ dur: 0.4, vol: 0.18 * v, f0: 1500, f1: 200 });
        break;
      case 'deflate':
        this.tone({ type: 'sawtooth', f0: 700, f1: 90, dur: 0.6, vol: 0.09 * v, curve: 'lin' });
        this.noise({ dur: 0.5, vol: 0.12 * v, type: 'bandpass', f0: 3000, f1: 800, q: 2 });
        break;
      case 'splat':
        this.noise({ dur: 0.25, vol: 0.28 * v, f0: 1800, f1: 200 });
        this.tone({ type: 'sine', f0: 300, f1: 60, dur: 0.2, vol: 0.2 * v });
        break;
      case 'super':
        [0, 0.06, 0.12, 0.18].forEach((d, i) => this.tone({ type: 'square', f0: (440 + i * 180) * p, f1: (560 + i * 220) * p, dur: 0.12, vol: 0.1 * v, at: T + d }));
        this.noise({ dur: 0.35, vol: 0.16 * v, type: 'bandpass', f0: 600, f1: 3000, q: 0.8 });
        break;
      case 'super_ready':
        this.tone({ type: 'triangle', f0: 880, dur: 0.12, vol: 0.14 * v });
        this.tone({ type: 'triangle', f0: 1318, dur: 0.22, vol: 0.14 * v, at: T + 0.09 });
        break;
      case 'gem':
        [1320, 1760, 2349].forEach((f, i) => this.tone({ type: 'triangle', f0: f * p, dur: 0.12, vol: 0.1 * v, at: T + i * 0.05 }));
        break;
      case 'cube':
        this.tone({ type: 'square', f0: 330, f1: 990, dur: 0.25, vol: 0.1 * v, curve: 'lin' });
        this.tone({ type: 'triangle', f0: 660, f1: 1980, dur: 0.25, vol: 0.08 * v, curve: 'lin' });
        break;
      case 'crate':
        this.noise({ dur: 0.45, vol: 0.35 * v, f0: 2200, f1: 150 });
        this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.35, vol: 0.3 * v });
        break;
      case 'pop':
        this.tone({ type: 'sine', f0: 600, f1: 1800, dur: 0.08, vol: 0.18 * v });
        this.noise({ dur: 0.05, vol: 0.1 * v, type: 'highpass', f0: 3000 });
        break;
      case 'helpers':
        [0, 0.08, 0.16].forEach((d, i) => this.tone({ type: 'sine', f0: 700 + i * 250, f1: 1400 + i * 300, dur: 0.1, vol: 0.14 * v, at: T + d }));
        break;
      case 'sneeze':
        this.tone({ type: 'triangle', f0: 380, f1: 520, dur: 0.18, vol: 0.12 * v, at: T });
        this.tone({ type: 'triangle', f0: 420, f1: 620, dur: 0.16, vol: 0.12 * v, at: T + 0.2 });
        this.noise({ dur: 0.28, vol: 0.3 * v, type: 'highpass', f0: 1800, at: T + 0.4 });
        break;
      case 'infect':
        this.tone({ type: 'sawtooth', f0: 900, f1: 200, dur: 0.4, vol: 0.08 * v });
        this.tone({ type: 'sine', f0: 300, f1: 450, dur: 0.4, vol: 0.12 * v, detune: 30 });
        break;
      case 'dash':
        this.noise({ dur: 0.35, vol: 0.25 * v, type: 'bandpass', f0: 400, f1: 2400, q: 0.7 });
        break;
      case 'click':
        this.tone({ type: 'square', f0: 900, f1: 1200, dur: 0.04, vol: 0.08 * v });
        break;
      case 'tab':
        this.tone({ type: 'triangle', f0: 600, f1: 800, dur: 0.06, vol: 0.1 * v });
        break;
      case 'coin':
        this.tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.08 * v });
        this.tone({ type: 'square', f0: 1319, dur: 0.18, vol: 0.08 * v, at: T + 0.07 });
        break;
      case 'buy':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.14, vol: 0.12 * v, at: T + i * 0.06 }));
        break;
      case 'levelup':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.16, vol: 0.08 * v, at: T + i * 0.07 }));
        this.noise({ dur: 0.6, vol: 0.1 * v, type: 'highpass', f0: 4000, at: T + 0.3 });
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: i === 5 ? 0.5 : 0.14, vol: 0.1 * v, at: T + i * 0.12 }));
        break;
      case 'lose':
        [392, 370, 349, 262].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, f1: i === 3 ? 200 : f, dur: i === 3 ? 0.7 : 0.28, vol: 0.08 * v, at: T + i * 0.3 }));
        break;
      case 'tick':
        this.tone({ type: 'square', f0: 1400, dur: 0.05, vol: 0.08 * v });
        break;
      case 'claw':
        if (!this.gate(name, 0.05)) return;
        this.noise({ dur: 0.14, vol: 0.24 * v, type: 'bandpass', f0: 2600 * p, f1: 700 * p, q: 1.4 });
        this.tone({ type: 'sawtooth', f0: 900 * p, f1: 320 * p, dur: 0.08, vol: 0.05 * v });
        break;
      case 'roar':
        if (!this.gate(name, 0.3)) return;
        this.tone({ type: 'sawtooth', f0: 150 * p, f1: 85 * p, dur: 0.6, vol: 0.16 * v, attack: 0.04 });
        this.tone({ type: 'square', f0: 225 * p, f1: 110 * p, dur: 0.5, vol: 0.06 * v, attack: 0.03, detune: 14 });
        this.noise({ dur: 0.55, vol: 0.2 * v, type: 'lowpass', f0: 1300 * p, f1: 300, attack: 0.03 });
        break;
      case 'slam':
        this.tone({ type: 'sine', f0: 170, f1: 40, dur: 0.38, vol: 0.32 * v });
        this.noise({ dur: 0.32, vol: 0.26 * v, type: 'lowpass', f0: 900, f1: 120 });
        break;
      case 'drop':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ type: 'triangle', f0: f * p, dur: 0.18, vol: 0.1 * v, at: T + i * 0.05 }));
        this.noise({ dur: 0.4, vol: 0.1 * v, type: 'highpass', f0: 5000, at: T + 0.15 });
        break;
      case 'countdown':
        this.tone({ type: 'square', f0: 660, dur: 0.12, vol: 0.1 * v });
        break;
      case 'go':
        this.tone({ type: 'square', f0: 990, dur: 0.3, vol: 0.12 * v });
        break;
      case 'emote':
        this.tone({ type: 'sine', f0: 500, f1: 900, dur: 0.1, vol: 0.12 * v });
        break;
      case 'box_shake':
        this.noise({ dur: 0.08, vol: 0.15 * v, type: 'bandpass', f0: 800, q: 3 });
        break;
      case 'box_open':
        this.noise({ dur: 0.6, vol: 0.3 * v, f0: 3000, f1: 300 });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.1 * v, at: T + 0.15 + i * 0.07 }));
        break;
      case 'reward':
        this.tone({ type: 'triangle', f0: 880 * p, f1: 1320 * p, dur: 0.12, vol: 0.12 * v });
        break;
      case 'whoosh':
        this.noise({ dur: 0.25, vol: 0.12 * v, type: 'bandpass', f0: 500, f1: 3000, q: 0.8 });
        break;
      case 'announce':
        this.tone({ type: 'triangle', f0: 523, dur: 0.12, vol: 0.12 * v });
        this.tone({ type: 'triangle', f0: 784, dur: 0.2, vol: 0.12 * v, at: T + 0.1 });
        break;
      case 'respawn':
        this.tone({ type: 'sine', f0: 400, f1: 1200, dur: 0.3, vol: 0.1 * v });
        break;
    }
  }

  vibrate(ms: number | number[]) {
    if (this.vibration && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* не поддерживается */ }
  }
}

export type SfxName =
  | 'shoot_smile' | 'shoot_germ' | 'shoot_robot' | 'laser' | 'punch' | 'hit' | 'hurt' | 'death' | 'deflate' | 'splat'
  | 'super' | 'super_ready' | 'gem' | 'cube' | 'crate' | 'pop' | 'helpers' | 'sneeze' | 'infect' | 'dash'
  | 'click' | 'tab' | 'coin' | 'buy' | 'levelup' | 'win' | 'lose' | 'tick' | 'countdown' | 'go' | 'emote'
  | 'box_shake' | 'box_open' | 'reward' | 'whoosh' | 'announce' | 'respawn' | 'claw' | 'roar' | 'slam' | 'drop';

export const audio = new AudioEngine();
export const sfx = (name: SfxName, o?: { pitch?: number; vol?: number }) => audio.play(name, o);
