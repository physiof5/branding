import { useEffect, useState } from 'react';
import { useBattleAudio } from '../../audio/useBattleAudio';
import { useBattleControls } from '../../hooks/useBattleControls';
import { useBattleLoop } from '../../hooks/useBattleLoop';
import type { MatchOutcome } from '../../game/types';
import { BattleCanvas } from '../../scene/BattleCanvas';
import { battleEvents, useBattleStore } from '../../store/battleStore';
import { consumePendingBattle, rematch } from '../../store/matchmaking';
import { useProfileStore, type MatchReport } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';
import { BattleHud } from '../hud/BattleHud';
import { PauseMenu, ResultOverlay } from '../hud/Overlays';

export function BattleScreen() {
  const phase = useBattleStore((s) => s.phase);
  const paused = useBattleStore((s) => s.paused);
  const [report, setReport] = useState<MatchReport | null>(null);

  useBattleLoop(true);
  useBattleAudio();
  useBattleControls();

  useEffect(
    () =>
      battleEvents.on((e) => {
        const s = useBattleStore.getState();
        const mode = s.config?.mode;
        if (e.type === 'start') setReport(null);
        // 랭크전에서 쓴 전투 아이템은 인벤토리에서 차감
        if (e.type === 'item' && e.player === 0 && mode === 'ai') useProfileStore.getState().consumeItem(e.item);
        if (e.type === 'finish' && mode === 'ai') {
          const outcome: MatchOutcome = e.winner === 'draw' ? 'draw' : e.winner === 0 ? 'win' : 'lose';
          const last = s.log[s.log.length - 1];
          setReport(
            useProfileStore.getState().applyMatch({
              mode: 'ai',
              outcome,
              finisher: e.reason === 'ko' && last?.result.attacker === 0 ? last.result.topTier : null,
              perfect: s.fighters[0].damageTaken === 0,
              forfeit: e.reason === 'forfeit',
            }),
          );
        }
      }),
    [],
  );

  // 탭이 숨겨지면 자동 일시정지
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) useBattleStore.getState().setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 모든 구독(사운드·카메라·HUD)이 붙은 뒤에 배틀 시작
  useEffect(() => {
    const cfg = consumePendingBattle();
    if (cfg) useBattleStore.getState().start(cfg);
    else if (useBattleStore.getState().phase === 'idle') useUIStore.getState().go('lobby');
  }, []);

  const toLobby = () => {
    useBattleStore.getState().exit();
    useUIStore.getState().go('lobby');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <BattleCanvas />
      {/* HUD 는 배틀 시작 전에 마운트되어야 intro 이벤트(READY)를 놓치지 않는다 */}
      <BattleHud onPause={() => useBattleStore.getState().setPaused(true)} />
      {paused && phase !== 'finished' && (
        <PauseMenu
          onResume={() => useBattleStore.getState().setPaused(false)}
          onQuit={() => {
            const s = useBattleStore.getState();
            if (s.config?.mode === 'ai') s.forfeit(0);
            else toLobby();
          }}
        />
      )}
      {phase === 'finished' && <ResultOverlay report={report} onRematch={rematch} onLobby={toLobby} />}
    </div>
  );
}
