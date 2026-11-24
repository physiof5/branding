import { useEffect } from 'react';
import type { ChosenAction } from '../game/types';
import { useBattleStore } from '../store/battleStore';

// e.code(물리 키) 기준 → 한글 IME 상태에서도 동작
const P1_KEYS: Record<string, ChosenAction> = { KeyA: 'charge', KeyS: 'dodge', KeyD: 'attack', Digit1: 'charge', Digit2: 'dodge', Digit3: 'attack' };
const P2_KEYS: Record<string, ChosenAction> = {
  KeyJ: 'charge',
  KeyK: 'dodge',
  KeyL: 'attack',
  ArrowLeft: 'charge',
  ArrowDown: 'dodge',
  ArrowRight: 'attack',
  Numpad1: 'charge',
  Numpad2: 'dodge',
  Numpad3: 'attack',
};

/** 키보드: 1P A/S/D(1/2/3) · 2P J/K/L(←/↓/→) · 아이템 Q/E · 일시정지 ESC/P */
export function useBattleControls(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useBattleStore.getState();
      const mode = s.config?.mode;
      if (!mode) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        s.setPaused(!s.paused);
        return;
      }
      const a1 = P1_KEYS[e.code];
      const a2 = P2_KEYS[e.code];
      if (a1) s.choose(0, a1);
      else if (a2) s.choose(mode === 'local' ? 1 : 0, a2);
      else if (mode === 'ai' && e.code === 'KeyQ') s.useItem(0, 'shield');
      else if (mode === 'ai' && e.code === 'KeyE') s.useItem(0, 'jam');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
