import { MAPS } from '../../data/maps';
import { passLevelFor } from '../../data/seasonPass';
import { TIMING } from '../../game/constants';
import { TIERS } from '../../game/rank';
import { useBattleStore } from '../../store/battleStore';
import type { MatchReport } from '../../store/profileStore';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../components/Button';

export function ResultOverlay({ report, onRematch, onLobby }: { report: MatchReport | null; onRematch: () => void; onLobby: () => void }) {
  const winner = useBattleStore((s) => s.winner);
  const reason = useBattleStore((s) => s.finishReason);
  const mode = useBattleStore((s) => s.config?.mode);
  const name0 = useBattleStore((s) => s.fighters[0].name);
  const name1 = useBattleStore((s) => s.fighters[1].name);
  const names = [name0, name1] as const;
  const turn = useBattleStore((s) => s.turn);
  const xp = useProfileStore((s) => s.pass.xp);

  let title = '무승부';
  let color = '#ffffff';
  if (winner !== 'draw' && winner !== null) {
    if (mode === 'ai') {
      title = winner === 0 ? '승리!' : '패배…';
      color = winner === 0 ? '#ffe66b' : '#ff8a95';
    } else {
      title = `${names[winner]} 승리!`;
      color = winner === 0 ? '#7cc0ff' : '#ff8a95';
    }
  }
  const reasonText = reason === 'ko' ? `K.O. · ${turn}턴` : reason === 'timeover' ? `${TIMING.maxTurns}턴 종료 · 체력 판정` : '기권';
  const promoted = report && report.tierAfter.min > report.tierBefore.min;
  const demoted = report && report.tierAfter.min < report.tierBefore.min;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0d0a1f]/60 p-4 backdrop-blur-[2px]">
      <div className="anim-pop w-full max-w-sm rounded-3xl border-2 border-white/15 bg-[#241d47]/95 p-5 text-center shadow-2xl">
        <div className="font-display text-outline text-6xl" style={{ color }}>
          {title}
        </div>
        <div className="font-display mt-1 text-white/70">{reasonText}</div>

        {mode === 'local' && <p className="mt-3 text-sm text-white/70">친선전은 랭크·재화 변동이 없어요.</p>}

        {report && (
          <div className="mt-4 space-y-2 text-left">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-black/25 p-2">
                <div className="text-xs text-white/60">골드</div>
                <div className="font-display text-xl text-[#ffd76a]">+{report.gold}</div>
              </div>
              <div className="rounded-2xl bg-black/25 p-2">
                <div className="text-xs text-white/60">트로피</div>
                <div className={`font-display text-xl ${report.trophies >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {report.trophies >= 0 ? '+' : ''}
                  {report.trophies}
                </div>
              </div>
              <div className="rounded-2xl bg-black/25 p-2">
                <div className="text-xs text-white/60">패스 XP</div>
                <div className="font-display text-xl text-sky-300">+{report.xp}</div>
              </div>
            </div>
            {report.bonuses.map((b) => (
              <div key={b.label} className="flex justify-between rounded-xl bg-white/5 px-3 py-1 text-sm">
                <span>✨ {b.label}</span>
                <span className="text-[#ffd76a]">+{b.gold}G</span>
              </div>
            ))}
            {promoted && (
              <div className="font-display rounded-2xl bg-gradient-to-r from-amber-300 to-pink-300 px-3 py-2 text-center text-[#2a1600]">
                {report.tierAfter.emoji} {report.tierAfter.name} 승급! 새 맵: {MAPS[report.tierAfter.mapId].name}
              </div>
            )}
            {demoted && (
              <div className="font-display rounded-2xl bg-white/10 px-3 py-2 text-center text-white/80">
                {report.tierAfter.emoji} {report.tierAfter.name}(으)로 강등… 다시 올라가자!
              </div>
            )}
            {report.passLevelAfter > report.passLevelBefore && (
              <div className="font-display rounded-2xl bg-[#4da3ff]/25 px-3 py-2 text-center text-sky-200">
                👑 로열 패스 Lv.{report.passLevelAfter} 달성 — 보상을 받으세요!
              </div>
            )}
            <div className="text-center text-xs text-white/50">
              현재 {report.tierAfter.emoji} {report.tierAfter.name} · 🏆 {report.trophiesAfter} · 패스 Lv.{passLevelFor(xp)}
              {(() => {
                const next = TIERS.find((t) => t.min > report.trophiesAfter);
                return next ? ` · ${next.name}까지 ${next.min - report.trophiesAfter}` : '';
              })()}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onLobby}>
            로비로
          </Button>
          <Button variant="primary" onClick={onRematch}>
            한 판 더!
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const mode = useBattleStore((s) => s.config?.mode);
  const muted = useSettingsStore((s) => s.muted);
  const toggleMute = useSettingsStore((s) => s.toggleMute);
  const shake = useSettingsStore((s) => s.cameraShake);
  const setShake = useSettingsStore((s) => s.setCameraShake);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0d0a1f]/70 p-4 backdrop-blur-sm">
      <div className="anim-pop w-full max-w-xs space-y-3 rounded-3xl border-2 border-white/15 bg-[#241d47] p-5 text-center">
        <div className="font-display text-3xl">일시정지</div>
        <Button variant="green" className="w-full" onClick={onResume}>
          계속하기
        </Button>
        <Button variant="ghost" className="w-full" onClick={toggleMute}>
          {muted ? '🔇 소리 켜기' : '🔊 소리 끄기'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setShake(shake > 0.5 ? 0.3 : shake > 0 ? 0 : 1)}>
          📳 화면 흔들림: {shake > 0.5 ? '강하게' : shake > 0 ? '약하게' : '끄기'}
        </Button>
        <Button variant="dark" className="w-full" onClick={onQuit}>
          {mode === 'ai' ? '기권하고 나가기 (패배 처리)' : '로비로 나가기'}
        </Button>
      </div>
    </div>
  );
}
