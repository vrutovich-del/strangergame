import './ui/styles.css';
import { audio } from './audio/sfx';
import { buildLineup } from './modes/lineup';
import { GameRenderer } from './render/renderer';
import { simplifierReady } from './render/simplify';
import { Match } from './sim/match';
import { BattleScreen, LocalSource } from './ui/battle';
import { startLoop } from './core/loop';

async function start() {
  await simplifierReady;
  const r = new GameRenderer(document.getElementById('game') as HTMLCanvasElement);
  const params = new URLSearchParams(location.search);
  const mode = (params.get('play') as any) ?? 'gemgrab';
  const hero = params.get('hero') ?? 'smile';
  const cfg = buildLineup({ mode, humans: [{ name: 'Игрок', heroId: hero, skinId: params.get('skin') ?? 'default', level: 1, owner: 'local' }], difficulty: 'normal', seed: Date.now() & 0xffff, mapId: params.get('map') ?? undefined, tutorial: params.has('tut') });
  const match = new Match(cfg);
  const me = match.fighterOf('local')!;
  const src = new LocalSource(match, me.id);
  document.getElementById('boot')!.classList.add('hide');
  window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
  let screen: BattleScreen | null = new BattleScreen(r, src, { onEnd: (res) => { console.log('result', res); }, showHints: true, emotes: [0, 1, 2, 3] });
  (window as any).__src = src; (window as any).__screen = screen;
  startLoop((dt, now) => {
    r.track(dt, now);
    if (screen && !screen.frame(dt)) { screen.dispose(); screen = null; }
    (window as any).__info = r.gl.info.render;
  });
}
start();
