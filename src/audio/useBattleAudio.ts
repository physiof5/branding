import { useEffect } from 'react';
import { battleEvents, useBattleStore } from '../store/battleStore';
import { useSettingsStore } from '../store/settingsStore';
import { sound } from './SoundEngine';

/** 볼륨 설정을 엔진에 동기화 */
export function useSoundSettings(): void {
  const master = useSettingsStore((s) => s.masterVolume);
  const sfx = useSettingsStore((s) => s.sfxVolume);
  const bgm = useSettingsStore((s) => s.bgmVolume);
  const muted = useSettingsStore((s) => s.muted);
  useEffect(() => {
    sound.setVolumes({ master, sfx, bgm, muted });
  }, [master, sfx, bgm, muted]);
}

/** 배틀 이벤트 → 효과음/BGM 템포 */
export function useBattleAudio(): void {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    const updateIntensity = () => {
      const s = useBattleStore.getState();
      const danger = s.fighters.some((f) => f.stacks >= 8 || (f.hp > 0 && f.hp <= 30));
      sound.setIntensity(danger ? 2 : 0);
    };

    const off = battleEvents.on((e) => {
      const s = useBattleStore.getState();
      switch (e.type) {
        case 'start':
          sound.startBgm('battle');
          sound.setIntensity(0);
          break;
        case 'phase':
          if (e.phase === 'intro') sound.play('ready');
          if (e.phase === 'select') {
            if (e.turn === 1) sound.play('fight');
            updateIntensity();
          }
          if (e.phase === 'reveal') sound.play('reveal');
          if (e.phase === 'action' && s.result) {
            const [a, b] = s.result.outcomes;
            const acts = [a, b];
            if (acts.some((o) => o.tier === 'special')) sound.play('specialRise');
            else if (acts.some((o) => o.action === 'attack')) later(120, () => sound.play('swing'));
            if (acts.some((o) => o.action === 'charge')) sound.play('charge', { gain: 0.8 });
            if (acts.some((o) => o.action === 'dodge')) later(260, () => sound.play('dodge'));
          }
          break;
        case 'countdown':
          if (e.seconds === 1) {
            sound.play('tickFinal');
            sound.setIntensity(s.fighters.some((f) => f.stacks >= 8) ? 2 : 1);
          } else sound.play('tick');
          break;
        case 'overtime':
          if (e.first) sound.play('fight');
          later(e.first ? 500 : 0, () => sound.play('chargeDone', { gain: 0.7 }));
          sound.setIntensity(2);
          break;
        case 'lock':
          if (!e.timeout) sound.play('lock', { gain: s.fighters[e.player].controller === 'ai' ? 0.45 : 1 });
          break;
        case 'item':
          sound.play(e.item === 'shield' ? 'shield' : 'jam');
          break;
        case 'impact': {
          const r = e.result;
          switch (r.kind) {
            case 'hit':
              sound.play('hit');
              break;
            case 'power':
            case 'overpower':
              sound.play('powerHit');
              break;
            case 'special':
              sound.play('specialBoom');
              break;
            case 'clash':
              sound.play(r.topTier === 'special' ? 'specialBoom' : 'clash');
              break;
            case 'blocked':
              sound.play('shieldBreak');
              break;
            case 'dodge':
              sound.play('whiff');
              break;
            case 'quiet':
              break;
          }
          if (r.outcomes.some((o) => o.stackGained)) later(60, () => sound.play('chargeDone', { gain: 0.8 }));
          if (r.ko[0] || r.ko[1]) later(250, () => sound.play('ko'));
          updateIntensity();
          break;
        }
        case 'finish': {
          const cfg = s.config;
          const humanWon = cfg?.mode === 'local' ? e.winner !== 'draw' : e.winner === 0;
          later(200, () => sound.play(humanWon ? 'win' : 'lose'));
          sound.setIntensity(0);
          break;
        }
        case 'swap':
          later(150, () => sound.play('fight'));
          break;
        case 'exit':
          sound.stopBgm();
          break;
        case 'pause':
          break;
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, []);
}
