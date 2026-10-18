// Синтезированная музыка: спокойная петля для меню и бодрая для боя. Всё играется кодом.
import { audio } from './sfx';

type Track = 'lobby' | 'battle' | 'none';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Song {
  bpm: number;
  /** Аккорды по тактам (MIDI ноты). */
  chords: number[][];
  bass: number[];
  lead: (number | null)[];
  drums: string;
  swing?: number;
}

const SONGS: Record<Exclude<Track, 'none'>, Song> = {
  lobby: {
    bpm: 104,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    bass: [48, 48, 55, 48, 45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43],
    lead: [72, null, 76, 79, null, 76, 74, null, 72, null, 69, 72, null, 71, 72, null,
      69, null, 72, 76, null, 74, 72, null, 67, null, 71, 74, null, 72, 71, null],
    drums: 'k-h-s-h-k-hks-h-',
    swing: 0.12,
  },
  battle: {
    bpm: 132,
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
    bass: [45, 45, 57, 45, 45, 57, 45, 52, 41, 41, 53, 41, 43, 43, 55, 47],
    lead: [69, 72, 76, 72, 74, 72, 69, null, 65, 69, 72, 69, 71, 72, 74, null,
      67, 71, 74, 71, 72, 74, 76, null, 76, 74, 72, 71, 72, null, 69, null],
    drums: 'k-hsk-hskkhsk-hs',
  },
};

class Music {
  private track: Track = 'none';
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private gain: GainNode | null = null;

  play(track: Track) {
    if (track === this.track) return;
    this.stop();
    this.track = track;
    if (track === 'none' || !audio.ctx) return;
    const c = audio.ctx;
    this.gain = c.createGain();
    this.gain.gain.value = 0;
    this.gain.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
    this.gain.connect(audio.musicBus);
    this.step = 0;
    this.nextTime = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  /** Если звук разблокировали позже — запустить нужную музыку. */
  resume() {
    const t = this.track;
    if (t !== 'none' && !this.timer) { this.track = 'none'; this.play(t); }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    if (this.gain && audio.ctx) {
      const g = this.gain;
      g.gain.cancelScheduledValues(audio.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, audio.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, audio.ctx.currentTime + 0.4);
      setTimeout(() => g.disconnect(), 600);
    }
    this.gain = null;
    this.track = 'none';
  }

  private schedule() {
    const c = audio.ctx;
    if (!c || !this.gain || this.track === 'none') return;
    const song = SONGS[this.track];
    const sixteenth = 60 / song.bpm / 4;
    while (this.nextTime < c.currentTime + 0.2) {
      const s = this.step;
      const t = this.nextTime + (s % 2 ? (song.swing ?? 0) * sixteenth : 0);
      this.playStep(song, s, t, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(song: Song, s: number, t: number, len: number) {
    const bus = this.gain!;
    const bar = Math.floor(s / 16) % song.chords.length;
    const i16 = s % 16;
    // барабаны
    const d = song.drums[i16];
    if (d === 'k') { audio.tone({ type: 'sine', f0: 150, f1: 45, dur: 0.18, vol: 0.5, at: t, bus }); }
    if (d === 's') { audio.noise({ dur: 0.14, vol: 0.18, type: 'bandpass', f0: 1800, q: 0.7, at: t, bus }); audio.tone({ type: 'triangle', f0: 220, f1: 160, dur: 0.08, vol: 0.12, at: t, bus }); }
    if (d === 'h' || i16 % 2 === 1) audio.noise({ dur: 0.04, vol: 0.06, type: 'highpass', f0: 7000, at: t, bus });
    // бас — восьмыми
    if (i16 % 2 === 0) {
      const n = song.bass[(bar * 4 + Math.floor(i16 / 4)) % song.bass.length];
      audio.tone({ type: 'triangle', f0: NOTE(n - 12), dur: len * 1.8, vol: 0.28, at: t, bus });
      audio.tone({ type: 'sawtooth', f0: NOTE(n - 12), dur: len * 1.2, vol: 0.04, at: t, bus });
    }
    // аккорды — на сильные доли
    if (i16 === 0 || i16 === 8) {
      for (const n of song.chords[bar]) audio.tone({ type: 'sine', f0: NOTE(n), dur: len * 7, vol: 0.05, at: t, attack: 0.05, bus });
    }
    // мелодия — восьмыми, через такт
    if (i16 % 2 === 0) {
      const li = ((Math.floor(s / 2)) % song.lead.length);
      const n = song.lead[li];
      if (n && Math.floor(s / 64) % 2 === 1) audio.tone({ type: 'square', f0: NOTE(n), dur: len * 1.6, vol: 0.045, at: t, bus });
      if (n && Math.floor(s / 64) % 2 === 1) audio.tone({ type: 'triangle', f0: NOTE(n + 12), dur: len * 1.2, vol: 0.03, at: t, bus });
    }
  }
}

export const music = new Music();
