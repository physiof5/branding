import { useEffect } from 'react';
import { useBattleStore } from '../store/battleStore';

/** 배틀 시계를 rAF 로 구동 (실제 경과 ms 전달 → 스토어가 슬로모/일시정지 반영) */
export function useBattleLoop(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      useBattleStore.getState().tick(now - last);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
