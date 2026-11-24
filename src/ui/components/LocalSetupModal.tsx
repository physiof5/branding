import { useState } from 'react';
import { MAPS, MAP_ORDER, type MapId } from '../../data/maps';
import { TIERS } from '../../game/rank';
import { startLocalBattle } from '../../store/matchmaking';
import { Button } from './Button';
import { Modal } from './Modal';

export function LocalSetupModal({ onClose }: { onClose: () => void }) {
  const [mapId, setMapId] = useState<MapId>('classroom');
  return (
    <Modal title="👥 로컬 2인 대전" onClose={onClose} wide>
      <p className="mb-3 text-sm text-white/75">
        한 화면에서 둘이 동시에 몰래 고르세요. 누른 버튼은 상대에게 보이지 않아요!
        <br />
        키보드: <b>1P</b> A·S·D / <b>2P</b> J·K·L &nbsp;|&nbsp; 터치: 왼쪽 1P · 오른쪽 2P
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MAP_ORDER.map((id) => {
          const m = MAPS[id];
          const tier = TIERS.find((t) => t.mapId === id)!;
          const on = id === mapId;
          return (
            <button
              key={id}
              onClick={() => setMapId(id)}
              className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'border-[#ff6f91] bg-[#ff6f91]/15' : 'border-white/10 bg-white/5'}`}
            >
              <div className="mb-1 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${m.sky}, ${m.fog.color})` }} />
              <div className="font-display text-base leading-tight">{m.name}</div>
              <div className="text-[11px] text-white/60">
                {tier.emoji} {tier.name} 맵
              </div>
            </button>
          );
        })}
      </div>
      <Button
        className="w-full py-4 text-xl"
        onClick={() => {
          onClose();
          startLocalBattle(mapId);
        }}
      >
        대결 시작!
      </Button>
    </Modal>
  );
}
