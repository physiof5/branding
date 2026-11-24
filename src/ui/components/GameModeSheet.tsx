import { MODES, MODE_ORDER } from '../../data/modes';
import { tierLabel } from '../../game/rank';
import { CHALLENGE_DAILY_GAMES, type MatchKind } from '../../game/rewards';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from './Modal';

/** 게임 모드 선택 (선택하면 전투 버튼의 모드가 바뀐다) */
export function GameModeSheet() {
  const close = () => useUIStore.getState().setModeSheetOpen(false);
  const current = useSettingsStore((s) => s.modePrefs.mode);
  const setPrefs = useSettingsStore((s) => s.setModePrefs);
  const trophies = useProfileStore((s) => s.trophies);
  const flex = useProfileStore((s) => s.flexTrophies);
  const challenge = useProfileStore((s) => s.challengeToday());

  const status: Record<MatchKind, string> = {
    ranked: `${tierLabel(trophies)} · 🏆 ${trophies}`,
    flex: `${tierLabel(flex)} · 🏆 ${flex}`,
    challenge: `오늘 ${challenge.played}/${CHALLENGE_DAILY_GAMES}판 · 승리 ${challenge.wins} · 🎁 ${challenge.rewards.length}개`,
    local: '누른 버튼은 상대에게 비밀!',
  };

  return (
    <Modal title="게임 모드" onClose={close} wide>
      <div className="space-y-3">
        {MODE_ORDER.map((id) => {
          const m = MODES[id];
          const on = id === current;
          return (
            <button
              key={id}
              onClick={() => {
                setPrefs({ mode: id });
                close();
              }}
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl p-4 text-left text-white transition-transform active:scale-[0.98] ${on ? 'ring-4 ring-[#ffd23f]' : ''}`}
              style={{ background: `linear-gradient(120deg, ${m.colors[0]}, ${m.colors[1]})` }}
            >
              <div className="min-w-0 flex-1">
                <div className="font-display text-2xl leading-tight drop-shadow">{m.name}</div>
                <div className="font-display text-sm text-white/90">{m.tagline}</div>
                <div className="mt-2 inline-block rounded-full bg-black/25 px-3 py-0.5 text-xs">{status[id]}</div>
              </div>
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 text-4xl">{m.emoji}</div>
              {on && <span className="font-display absolute top-2 right-3 rounded-full bg-[#ffd23f] px-2 text-xs text-[#2a1f00]">선택됨</span>}
            </button>
          );
        })}
        <div className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-white/20 p-4 text-white/60">
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg">🌐 온라인 랭크 매칭</div>
            <div className="text-xs">곧 공개됩니다! (매칭 서버 연결 예정)</div>
          </div>
          <span className="font-display rounded-full bg-white/10 px-3 py-1 text-xs">COMING SOON</span>
        </div>
      </div>
    </Modal>
  );
}
