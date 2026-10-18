// Анимации роботов: походка, отдача, удар, падение.
import type { HeroView } from '../render/heroView';
import { ease } from '../render/heroView';
import { createRobot, ROBOT_JOINTS } from './robotModels';

function robotView(id: string, kind: string, scale: number, height: number): HeroView {
  return {
    id,
    joints: ROBOT_JOINTS,
    scale,
    outline: [0x14101e, 0.022],
    height,
    muzzle: kind === 'blaster' || kind === 'sniper' ? 'weapon' : 'hand_R',
    build(_skin, teamColor) { return createRobot(kind, teamColor); },
    animate(r, s) {
      const torso = r.bone('torso')!, body = r.body, t = s.t;
      const head = r.bone('head'), legL = r.bone('leg_L'), legR = r.bone('leg_R');
      const armL = r.bone('arm_L'), armR = r.bone('arm_R'), ant = r.bone('antenna');
      if (s.dead >= 0) {
        // разваливается и падает
        const k = Math.min(1, s.dead / 0.5);
        torso.rotation.x = -k * 1.3;
        torso.position.y -= k * 0.35;
        if (head) { head.position.y += k * 0.3; head.rotation.z = k * 1.2; }
        if (armL) armL.rotation.z = k * 1.4;
        if (armR) armR.rotation.z = -k * 1.4;
        body.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 0.9) * 2));
        return;
      }
      const run = s.move;
      const f = kind === 'tank' ? 7 : 10;
      if (kind === 'dummy') {
        torso.rotation.z = Math.sin(t * 3) * 0.04 + Math.sin(s.hurt * 30) * 0.25 * ease.decay(s.hurt, 0.6);
        torso.rotation.x = -0.3 * ease.decay(s.hurt, 0.4);
      } else {
        body.position.y = Math.abs(Math.sin(t * f)) * 0.06 * run;
        if (legL && legR) { legL.rotation.x = Math.sin(t * f) * 0.7 * run; legR.rotation.x = -Math.sin(t * f) * 0.7 * run; }
        if (armL && armR) { armL.rotation.x = -Math.sin(t * f) * 0.5 * run; armR.rotation.x = Math.sin(t * f) * 0.5 * run; }
        torso.rotation.x = run * 0.1;
        torso.rotation.z = Math.sin(t * f * 0.5) * 0.05 * run;
      }
      if (head) { head.rotation.y = Math.sin(t * 0.9) * 0.15; head.position.y += Math.sin(t * 2.5) * 0.015; }
      if (ant) ant.rotation.z = Math.sin(t * 7) * 0.2 + (run ? Math.sin(t * f) * 0.3 : 0);
      // атака
      const shot = ease.decay(s.shot, 0.3);
      if (shot) {
        if (kind === 'tank') { if (armR) { armR.rotation.x = -1.6 * ease.pulse(s.shot, 0.3); } torso.rotation.y = -0.3 * ease.pulse(s.shot, 0.3); }
        else { torso.rotation.x -= 0.15 * shot; const w = r.bone('weapon'); if (w) w.position.z -= 0.1 * shot; }
      }
      const sup = ease.pulse(s.sup, 0.5);
      if (sup) {
        if (kind === 'tank') { torso.rotation.x += 0.4 * sup; if (armL) armL.rotation.x = -1.5 * sup; if (armR) armR.rotation.x = -1.5 * sup; }
        else body.position.y += sup * 0.25;
      }
      const hurt = ease.decay(s.hurt, 0.3);
      if (hurt && kind !== 'dummy') torso.rotation.x -= 0.2 * hurt;
      if (s.win) { body.position.y = Math.abs(Math.sin(t * 6)) * 0.25; if (armL) armL.rotation.z = 2.5; if (armR) armR.rotation.z = -2.5; }
    },
  };
}

export const ROBOT_VIEWS: HeroView[] = [
  robotView('robo_blaster', 'blaster', 0.78, 1.45),
  robotView('robo_tank', 'tank', 0.78, 1.5),
  robotView('robo_sniper', 'sniper', 0.78, 1.6),
  robotView('robo_dummy', 'dummy', 0.85, 1.55),
];
