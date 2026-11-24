import { useState } from 'react';
import { ITEMS } from '../../data/items';
import { MAPS, MAP_ORDER } from '../../data/maps';
import { MODES } from '../../data/modes';
import { TIERS, tierForTrophies, tierLabel } from '../../game/rank';
import { CHALLENGE_DAILY_GAMES } from '../../game/rewards';
import { launchMatch, teamSizeFor, type PartnerKind } from '../../store/matchmaking';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { Button } from './Button';
import { Modal } from './Modal';

const AI_LABEL = ['새내기 AI', '눈치 AI', '전략 AI', '마스터 AI'];

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-black/25 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`font-display rounded-xl py-2 text-sm transition ${o.v === value ? 'bg-[#ffd23f] text-[#2a1f00]' : 'text-white/75'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ id, label, sub, checked, disabled, onChange }: { id: string; label: string; sub: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={`flex items-center justify-between gap-3 rounded-2xl bg-white/7 px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <span>
        <span className="font-display block">{label}</span>
        <span className="text-xs text-white/60">{sub}</span>
      </span>
      <input id={id} type="checkbox" className="h-6 w-6 accent-[#ffc542]" disabled={disabled} checked={checked && !disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** 전투 준비: 큐/파티 구성 · 기폭제 사용 여부를 정하고 참가 */
export function LoadoutSheet() {
  const close = () => useUIStore.getState().setLoadoutOpen(false);
  const prefs = useSettingsStore((s) => s.modePrefs);
  const setPrefs = useSettingsStore((s) => s.setModePrefs);
  const inventory = useProfileStore((s) => s.inventory);
  const trophies = useProfileStore((s) => s.trophies);
  const flexTrophies = useProfileStore((s) => s.flexTrophies);
  const challenge = useProfileStore((s) => s.challengeToday());
  const [cat, setCat] = useState<[boolean, boolean]>([false, false]);

  const mode = prefs.mode;
  const def = MODES[mode];
  const ladder = mode === 'flex' ? flexTrophies : trophies;
  const tier = tierForTrophies(ladder);
  const aiLevel = mode === 'challenge' ? Math.min(3, tier.aiLevel + 1) : tier.aiLevel;
  const size = teamSizeFor({ mode, queue: prefs.queue, partySize: prefs.partySize });
  const partners: PartnerKind[] = Array.from({ length: Math.max(0, size - 1) }, (_, i) => prefs.partners[i] ?? 'ai');
  const challengeDone = mode === 'challenge' && challenge.played >= CHALLENGE_DAILY_GAMES;
  const catalysts = inventory.catalyst;

  const setPartner = (i: number, k: PartnerKind) => {
    const next = [...prefs.partners];
    next[i] = k;
    setPrefs({ partners: next });
  };

  const start = () => {
    close();
    launchMatch({ mode, queue: prefs.queue, partySize: prefs.partySize, partners, catalyst: cat, mapId: prefs.localMap });
  };

  return (
    <Modal title="전투 준비" onClose={close} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-3xl p-4 text-white" style={{ background: `linear-gradient(120deg, ${def.colors[0]}, ${def.colors[1]})` }}>
          <div className="text-4xl">{def.emoji}</div>
          <div className="min-w-0">
            <div className="font-display text-xl leading-tight">{def.name}</div>
            <div className="text-xs text-white/90">{def.desc}</div>
          </div>
        </div>

        {mode === 'ranked' && (
          <section className="space-y-2">
            <div className="font-display">큐 선택</div>
            <Segmented
              value={prefs.queue}
              options={[
                { v: 'solo', label: '🙋 솔로 (1:1)' },
                { v: 'duo', label: '👫 듀오 (2:2 릴레이)' },
              ]}
              onChange={(v) => setPrefs({ queue: v })}
            />
          </section>
        )}

        {mode === 'flex' && (
          <section className="space-y-2">
            <div className="font-display">파티 인원</div>
            <Segmented
              value={Math.max(1, Math.min(3, prefs.partySize))}
              options={[
                { v: 1, label: '1인' },
                { v: 2, label: '2인' },
                { v: 3, label: '3인' },
              ]}
              onChange={(v) => setPrefs({ partySize: v })}
            />
          </section>
        )}

        {partners.length > 0 && (
          <section className="space-y-2">
            <div className="font-display">파트너 (출전 순서: 나 → 파트너)</div>
            {partners.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm text-white/70">{i + 2}번 주자</span>
                <div className="flex-1">
                  <Segmented
                    value={k}
                    options={[
                      { v: 'ai', label: '🤖 AI 파트너' },
                      { v: 'friend', label: '👥 같은 기기 친구' },
                    ]}
                    onChange={(v) => setPartner(i, v)}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-white/60">릴레이 대결: 한 명씩 나가 1:1 로 싸우고, 쓰러지면 다음 주자가 이어받아요. 친구는 자기 차례에 기기를 넘겨받아 조작해요.</p>
          </section>
        )}

        {mode === 'challenge' && (
          <section className="rounded-2xl bg-white/7 p-3">
            <div className="font-display mb-2 flex justify-between">
              <span>오늘의 도전</span>
              <span className="text-[#ffd76a]">
                {challenge.played}/{CHALLENGE_DAILY_GAMES}판
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: CHALLENGE_DAILY_GAMES }, (_, k) => (
                <span key={k} className={`h-2.5 flex-1 rounded-full ${k < challenge.played ? 'bg-[#ffd23f]' : 'bg-black/35'}`} />
              ))}
            </div>
            <div className="mt-2 text-sm text-white/75">
              승리 {challenge.wins}번 · 받은 아이템: {challenge.rewards.length ? challenge.rewards.map((r) => ITEMS[r].emoji).join(' ') : '아직 없음'}
            </div>
          </section>
        )}

        {mode === 'local' ? (
          <section className="space-y-2">
            <div className="font-display">무대 선택</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MAP_ORDER.map((id) => {
                const m = MAPS[id];
                const t = TIERS.find((x) => x.mapId === id)!;
                const on = id === prefs.localMap;
                return (
                  <button
                    key={id}
                    onClick={() => setPrefs({ localMap: id })}
                    className={`rounded-2xl border-2 p-2 text-left transition ${on ? 'border-[#ffd23f] bg-[#ffd23f]/15' : 'border-white/10 bg-white/5'}`}
                  >
                    <div className="mb-1 h-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${m.sky}, ${m.fog.color})` }} />
                    <div className="font-display text-sm leading-tight">{m.name}</div>
                    <div className="text-[11px] text-white/60">
                      {t.emoji} {t.name} 무대
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white/7 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">무대</span>
              <span className="font-display">
                {tier.emoji} {MAPS[tier.mapId].name}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-white/60">상대</span>
              <span className="font-display">
                {AI_LABEL[aiLevel]} {size > 1 ? `· ${size}인 팀` : ''}
              </span>
            </div>
            {mode !== 'challenge' && (
              <div className="mt-1 flex justify-between">
                <span className="text-white/60">{mode === 'flex' ? '자유 랭크' : '솔로/듀오 랭크'}</span>
                <span className="font-display">
                  {tierLabel(ladder)} · 🏆 {ladder}
                </span>
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <div className="font-display">아이템</div>
          <Toggle
            id="cat-1p"
            label={mode === 'local' ? '⚡ 1P 기폭제 사용' : '⚡ 기폭제 사용'}
            sub={`시작할 때 기 +1 · 보유 ${catalysts}개`}
            checked={cat[0]}
            disabled={catalysts < 1}
            onChange={(v) => setCat([v, cat[1]])}
          />
          {mode === 'local' && (
            <Toggle
              id="cat-2p"
              label="⚡ 2P 기폭제 사용"
              sub={`같은 기기 인벤토리에서 사용 · 남은 ${Math.max(0, catalysts - (cat[0] ? 1 : 0))}개`}
              checked={cat[1]}
              disabled={catalysts - (cat[0] ? 1 : 0) < 1}
              onChange={(v) => setCat([cat[0], v])}
            />
          )}
          {mode !== 'local' && (
            <div className="rounded-2xl bg-white/7 px-4 py-2 text-xs text-white/70">
              전투 중 사용: {ITEMS.shield.emoji} 방어막 ×{Math.min(1, inventory.shield)} · {ITEMS.jam.emoji} 먹물 폭탄 ×{Math.min(1, inventory.jam)} (판당 1개, 상점에서 구매)
            </div>
          )}
        </section>

        <Button className="w-full py-4 text-2xl" variant={challengeDone ? 'dark' : 'primary'} disabled={challengeDone} onClick={start}>
          {challengeDone ? '오늘 도전 끝! 내일 다시 🎯' : '참가!'}
        </Button>
      </div>
    </Modal>
  );
}
