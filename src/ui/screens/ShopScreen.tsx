import { useState } from 'react';
import { sound } from '../../audio/SoundEngine';
import { COSTUMES, COSTUME_ORDER } from '../../data/costumes';
import { ITEMS, ITEM_ORDER, type ItemId } from '../../data/items';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';
import { Gold } from '../components/Bits';
import { Button } from '../components/Button';

export function ShopScreen() {
  const gold = useProfileStore((s) => s.gold);
  const inventory = useProfileStore((s) => s.inventory);
  const owned = useProfileStore((s) => s.ownedCostumes);
  const buyItem = useProfileStore((s) => s.buyItem);
  const buyCostume = useProfileStore((s) => s.buyCostume);
  const go = useUIStore((s) => s.go);
  const toast = useUIStore((s) => s.showToast);
  const [tab, setTab] = useState<'items' | 'costumes'>('items');

  const onBuyItem = (id: ItemId) => {
    if (buyItem(id)) {
      sound.play('buy');
      toast(`${ITEMS[id].emoji} ${ITEMS[id].name} 구매!`);
    } else toast('골드가 부족해요 🪙 랭크전에서 모아보세요');
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#3a2f78_0%,#1b1633_60%)]">
      <header className="mx-auto flex max-w-4xl items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <Button variant="ghost" className="px-3 py-2 text-base" onClick={() => go('lobby')}>
          ← 로비
        </Button>
        <h1 className="font-display flex-1 text-2xl">🛒 매점</h1>
        <Gold value={gold} />
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-4 pb-10">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/25 p-1">
          {(
            [
              ['items', '🧪 소모 아이템'],
              ['costumes', '👕 코스튬'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`font-display rounded-xl py-2.5 ${tab === id ? 'bg-[#ffc542] text-[#3b2600]' : 'text-white/70'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <div className="grid gap-3 sm:grid-cols-3">
            {ITEM_ORDER.map((id) => {
              const it = ITEMS[id];
              return (
                <div key={id} className="flex flex-col rounded-3xl border-2 border-white/10 bg-white/7 p-4">
                  <div className="text-5xl">{it.emoji}</div>
                  <div className="font-display mt-2 text-xl">{it.name}</div>
                  <div className="text-xs text-white/50">{it.usage === 'preBattle' ? '전투 전 자동 사용' : `전투 중 사용 (판당 ${it.maxPerBattle}회)`}</div>
                  <p className="mt-2 flex-1 text-sm text-white/80">{it.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-white/70">보유 {inventory[id]}</span>
                    <Button variant="gold" className="px-4 py-2 text-base" disabled={gold < it.price} onClick={() => onBuyItem(id)} silent>
                      🪙 {it.price}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'costumes' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COSTUME_ORDER.filter((id) => COSTUMES[id].price !== null && COSTUMES[id].price! > 0).map((id) => {
              const c = COSTUMES[id];
              const has = owned.includes(id);
              return (
                <div key={id} className="flex flex-col rounded-3xl border-2 border-white/10 bg-white/7 p-4">
                  <div className="mb-2 flex gap-1">
                    <span className="h-10 flex-1 rounded-lg" style={{ background: c.top }} />
                    <span className="h-10 w-8 rounded-lg" style={{ background: c.topAccent }} />
                    <span className="h-10 w-8 rounded-lg" style={{ background: c.bottom }} />
                  </div>
                  <div className="font-display text-lg leading-tight">{c.name}</div>
                  <div className="text-xs text-white/60">
                    {c.theme.kind === 'region' ? '📍 지역 테마' : '🏫 학교 테마'} · {c.theme.label}
                  </div>
                  <p className="mt-1 flex-1 text-sm text-white/75">{c.description}</p>
                  <Button
                    variant={has ? 'ghost' : 'gold'}
                    className="mt-3 py-2 text-base"
                    disabled={has || gold < (c.price ?? 0)}
                    silent
                    onClick={() => {
                      if (buyCostume(id)) {
                        sound.play('buy');
                        toast(`${c.name} 구매! 꾸미기에서 장착하세요`);
                      }
                    }}
                  >
                    {has ? '보유 중' : `🪙 ${c.price}`}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-white/50">모든 재화는 플레이로만 얻어요 · 코스튬은 외형 전용이며 능력치에 영향이 없어요</p>
      </main>
    </div>
  );
}
