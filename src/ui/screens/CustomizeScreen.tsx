import { useState } from 'react';
import { sound } from '../../audio/SoundEngine';
import { bodyLabel, buttLabel, HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from '../../data/appearance';
import { COSTUMES, COSTUME_ORDER, type CostumeId } from '../../data/costumes';
import { EFFECTS, EFFECT_ORDER } from '../../data/effects';
import { PASS_LEVELS } from '../../data/seasonPass';
import { CharacterPreview } from '../../scene/preview/CharacterPreview';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';
import { Gold, Slider } from '../components/Bits';
import { Button } from '../components/Button';

type Tab = 'body' | 'hair' | 'costume' | 'effect';
const TABS: { id: Tab; label: string }[] = [
  { id: 'body', label: '🍑 몸' },
  { id: 'hair', label: '💇 헤어' },
  { id: 'costume', label: '👕 코스튬' },
  { id: 'effect', label: '✨ 이펙트' },
];

function Swatch({ color, active, onClick, label }: { color: string; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-10 w-10 rounded-full border-[3px] transition ${active ? 'scale-110 border-white' : 'border-white/15'}`}
      style={{ background: color }}
    />
  );
}

function passLevelOf(kind: 'costume' | 'effect', id: string): string {
  for (const l of PASS_LEVELS) {
    for (const [track, r] of [
      ['무료', l.free],
      ['프리미엄', l.premium],
    ] as const) {
      if (r && r.kind === kind && (r.kind === 'costume' ? r.costumeId : r.kind === 'effect' ? r.effectId : '') === id) return `로열 패스 ${track} Lv.${l.level}`;
    }
  }
  return '이벤트 보상';
}

export function CustomizeScreen() {
  const a = useProfileStore((s) => s.appearance);
  const update = useProfileStore((s) => s.updateAppearance);
  const owned = useProfileStore((s) => s.ownedCostumes);
  const ownedFx = useProfileStore((s) => s.ownedEffects);
  const gold = useProfileStore((s) => s.gold);
  const buyCostume = useProfileStore((s) => s.buyCostume);
  const randomize = useProfileStore((s) => s.randomizeAppearance);
  const reset = useProfileStore((s) => s.resetAppearance);
  const go = useUIStore((s) => s.go);
  const toast = useUIStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('body');
  const [wiggle, setWiggle] = useState(0);

  const shake = () => {
    setWiggle((w) => w + 1);
    sound.play('wiggle', { gain: 0.6 });
  };

  const tryCostume = (id: CostumeId) => {
    if (owned.includes(id)) {
      update({ costumeId: id });
      return;
    }
    const c = COSTUMES[id];
    if (c.price === null) {
      toast(`🔒 ${passLevelOf('costume', id)}에서 얻을 수 있어요`);
      return;
    }
    if (buyCostume(id)) {
      sound.play('buy');
      update({ costumeId: id });
      toast(`${c.name} 구매 완료!`);
    } else toast('골드가 부족해요 🪙');
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#3a2f78_0%,#1b1633_60%)]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <Button variant="ghost" className="px-3 py-2 text-base" onClick={() => go('lobby')}>
          ← 로비
        </Button>
        <h1 className="font-display flex-1 text-2xl">꾸미기</h1>
        <Gold value={gold} />
      </header>

      <main className="mx-auto grid max-w-6xl gap-3 px-4 pb-8 md:grid-cols-[1fr_440px] md:gap-6">
        <section className="relative md:sticky md:top-4 md:self-start">
          <div className="h-[40dvh] min-h-[280px] md:h-[70dvh]">
            <CharacterPreview appearance={a} wiggleKey={wiggle} />
          </div>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
            <Button variant="primary" className="px-3 py-2 text-sm" onClick={shake}>
              🍑 엉덩이 흔들기
            </Button>
            <Button variant="ghost" className="px-3 py-2 text-sm" onClick={randomize}>
              🎲 랜덤
            </Button>
            <Button variant="ghost" className="px-3 py-2 text-sm" onClick={reset}>
              ↺ 기본
            </Button>
          </div>
        </section>

        <section className="rounded-3xl bg-white/7 p-4">
          <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-black/25 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`font-display rounded-xl py-2 text-sm transition sm:text-base ${tab === t.id ? 'bg-[#ff6f91] text-white' : 'text-white/70'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'body' && (
            <div className="space-y-5">
              <div className="rounded-2xl border-2 border-[#ff6f91]/40 bg-[#ff6f91]/10 p-3">
                <Slider
                  label="🍑 엉덩이 볼륨"
                  value={a.buttVolume}
                  hint={buttLabel(a.buttVolume)}
                  left="납작"
                  right="전설"
                  onChange={(v) => {
                    update({ buttVolume: v });
                    setWiggle((w) => w + 1);
                  }}
                />
              </div>
              <Slider label="체형" value={a.bodyType} hint={bodyLabel(a.bodyType)} left="슬림" right="든든" accent="#4da3ff" onChange={(v) => update({ bodyType: v })} />
              <Slider label="키" value={a.height} hint={a.height < 0.35 ? '아담' : a.height > 0.65 ? '훤칠' : '보통'} left="작게" right="크게" accent="#3ccf8e" onChange={(v) => update({ height: v })} />
              <div>
                <div className="font-display mb-2 text-lg">피부색</div>
                <div className="flex flex-wrap gap-2.5">
                  {SKIN_TONES.map((t) => (
                    <Swatch key={t.color} color={t.color} label={t.name} active={a.skin === t.color} onClick={() => update({ skin: t.color })} />
                  ))}
                </div>
              </div>
              <p className="rounded-2xl bg-black/25 p-3 text-sm text-white/75">
                💡 꾸미기는 <b>외형만</b> 바꿔요. 체력 100 · 공격력 · 회피 판정은 모든 유저가 똑같아요 (공정한 밸런스).
              </p>
            </div>
          )}

          {tab === 'hair' && (
            <div className="space-y-5">
              <div>
                <div className="font-display mb-2 text-lg">헤어스타일</div>
                <div className="grid grid-cols-3 gap-2">
                  {HAIR_STYLES.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => update({ hairStyle: h.id })}
                      className={`font-display rounded-2xl border-2 py-3 ${a.hairStyle === h.id ? 'border-[#ff6f91] bg-[#ff6f91]/15' : 'border-white/10 bg-white/5'}`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-display mb-2 text-lg">머리 색</div>
                <div className="flex flex-wrap gap-2.5">
                  {HAIR_COLORS.map((c) => (
                    <Swatch key={c.color} color={c.color} label={c.name} active={a.hairColor === c.color} onClick={() => update({ hairColor: c.color })} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'costume' && (
            <div className="grid grid-cols-2 gap-2">
              {COSTUME_ORDER.map((id) => {
                const c = COSTUMES[id];
                const has = owned.includes(id);
                const on = a.costumeId === id;
                return (
                  <button
                    key={id}
                    onClick={() => tryCostume(id)}
                    className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'border-[#ff6f91] bg-[#ff6f91]/15' : 'border-white/10 bg-white/5'} ${!has ? 'opacity-80' : ''}`}
                  >
                    <div className="mb-2 flex gap-1">
                      <span className="h-6 flex-1 rounded-md" style={{ background: c.top }} />
                      <span className="h-6 w-6 rounded-md" style={{ background: c.topAccent }} />
                      <span className="h-6 w-6 rounded-md" style={{ background: c.bottom }} />
                    </div>
                    <div className="font-display leading-tight">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-white/60">
                      {c.theme.kind === 'region' ? '📍 ' : c.theme.kind === 'school' ? '🏫 ' : c.theme.kind === 'pass' ? '👑 ' : ''}
                      {c.theme.label}
                    </div>
                    <div className="font-display mt-1 text-sm">
                      {on ? <span className="text-emerald-300">장착 중</span> : has ? '장착하기' : c.price !== null ? <span className="text-[#ffd76a]">🪙 {c.price} 구매</span> : <span className="text-white/60">🔒 패스 보상</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'effect' && (
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_ORDER.map((id) => {
                const fx = EFFECTS[id];
                const has = ownedFx.includes(id);
                const on = a.effectId === id;
                return (
                  <button
                    key={id}
                    onClick={() => (has ? update({ effectId: id }) : toast(`🔒 ${passLevelOf('effect', id)}에서 얻을 수 있어요`))}
                    className={`rounded-2xl border-2 p-3 text-left ${on ? 'border-[#ff6f91] bg-[#ff6f91]/15' : 'border-white/10 bg-white/5'} ${!has ? 'opacity-70' : ''}`}
                  >
                    <div
                      className="mb-2 h-8 rounded-lg"
                      style={{ background: fx.rainbow ? 'linear-gradient(90deg,#ff6b6b,#ffd36b,#6bffb0,#6bc8ff,#b46bff)' : `linear-gradient(90deg, ${fx.colors[0]}, ${fx.colors[1]})` }}
                    />
                    <div className="font-display">{fx.name}</div>
                    <div className="text-[11px] text-white/60">{fx.description}</div>
                    <div className="font-display mt-1 text-sm">{on ? <span className="text-emerald-300">장착 중</span> : has ? '장착하기' : <span className="text-white/60">🔒 {passLevelOf('effect', id)}</span>}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
