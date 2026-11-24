import { ITEMS, ITEM_ORDER } from '../../data/items';
import { TIERS } from '../../game/rank';
import { MAPS } from '../../data/maps';
import { OVERTIME_TURN, TIMING } from '../../game/constants';
import { useUIStore } from '../../store/uiStore';
import { Modal } from './Modal';

export function HelpModal() {
  const close = () => useUIStore.getState().setHelpOpen(false);
  return (
    <Modal title="❓ 게임 방법" onClose={close} wide>
      <div className="space-y-4 text-sm leading-relaxed text-white/85">
        <section>
          <h3 className="font-display mb-1 text-lg text-[#ff8fb0]">1. 3초 안에 동시에 고른다!</h3>
          <p>두 사람은 <b>엉덩이를 마주하고</b> 서 있어요. 매 턴 <b>3초 안에</b> 행동 하나를 동시에 고르고, 동시에 공개돼요. 못 고르면 💤 멍때리기(무방비).</p>
          <p className="mt-1 text-white/70">🍑 공격: 상체를 숙이며 엉덩이로 뒤를 들이받기 · 💨 피하기: 골반을 앞으로 쭉 빼서 엉덩이를 거둬들이기</p>
        </section>
        <section>
          <h3 className="font-display mb-2 text-lg text-[#ff8fb0]">2. 물고 물리는 상성</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-[#ff6f91]/20 p-2">
              <div className="text-2xl">🍑</div>
              <b>공격</b>은<br />
              무방비로 기 모으는 상대를 친다
            </div>
            <div className="rounded-2xl bg-[#ffc542]/20 p-2">
              <div className="text-2xl">🔥</div>
              <b>기 모으기</b>는<br />
              피하는 상대보다 이득
            </div>
            <div className="rounded-2xl bg-[#4da3ff]/20 p-2">
              <div className="text-2xl">💨</div>
              <b>피하기</b>는<br />
              일반·강력 공격 회피
            </div>
          </div>
          <p className="mt-2 text-white/70">기 모으기는 무방비 — 맞으면 데미지를 받아요 (기는 그래도 +1).</p>
        </section>
        <section>
          <h3 className="font-display mb-1 text-lg text-[#ff8fb0]">3. 공격 단계는 '기'로 결정</h3>
          <table className="w-full overflow-hidden rounded-2xl text-center">
            <tbody>
              <tr className="bg-white/7">
                <td className="p-2">기 0~2</td>
                <td className="font-display">일반 공격</td>
                <td>10 데미지</td>
                <td className="text-white/60">소모 없음</td>
              </tr>
              <tr className="bg-[#ff7a3d]/20">
                <td className="p-2">기 3+</td>
                <td className="font-display">강력 공격</td>
                <td>50 데미지</td>
                <td className="text-white/60">기 3 소모</td>
              </tr>
              <tr className="bg-[#ffd84a]/20">
                <td className="p-2">기 10</td>
                <td className="font-display">필살기</td>
                <td>100 즉사</td>
                <td className="text-white/60">회피·방어 불가</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-white/70">동시에 공격하면: 같은 단계는 💥상쇄, 다른 단계는 높은 쪽이 압도!</p>
          <p className="mt-1 text-white/70">
            🌙 <b>야자 타임</b>: {OVERTIME_TURN}턴부터 선택 시간 <b>{TIMING.overtimeTurnMs / 1000}초</b> + 매 턴 두 사람 모두 기 +1 — 누가 먼저 필살기를 쏠까? ({TIMING.maxTurns}턴이 지나면 체력 판정)
          </p>
        </section>
        <section>
          <h3 className="font-display mb-1 text-lg text-[#ff8fb0]">4. 아이템</h3>
          <ul className="space-y-1">
            {ITEM_ORDER.map((id) => (
              <li key={id}>
                {ITEMS[id].emoji} <b>{ITEMS[id].name}</b> — {ITEMS[id].description}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display mb-1 text-lg text-[#ff8fb0]">5. 게임 모드</h3>
          <ul className="space-y-1">
            <li>🏆 <b>클래식 랭크전</b> — 솔로(1:1) 또는 파트너와 듀오(2:2 릴레이)로 티어 올리기</li>
            <li>🤝 <b>자유 랭크전</b> — 1~3인 파티 팀 랭크 (한 명씩 나가 싸우는 릴레이, 별도 트로피)</li>
            <li>🎯 <b>클래식 도전</b> — 하루 10판, 이길 때마다 아이템 1개</li>
            <li>👥 <b>클래식 1v1</b> — 한 기기 2인 친선전 (누른 버튼은 비밀)</li>
          </ul>
          <p className="mt-1 text-white/70">⚡ 기폭제는 전투 준비 화면에서 쓸지 정하고 참가해요.</p>
        </section>
        <section>
          <h3 className="font-display mb-1 text-lg text-[#ff8fb0]">6. 티어 & 무대</h3>
          <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
            {TIERS.map((t) => (
              <div key={t.id} className="rounded-xl bg-white/7 px-2 py-1">
                {t.emoji} {t.name} ({t.min}+) · {MAPS[t.mapId].name}
              </div>
            ))}
          </div>
          <p className="mt-1 text-white/70">승리 +30 트로피(연승 보너스), 패배 -20. 티어가 오르면 AI도 똑똑해지고 무대가 바뀌어요.</p>
        </section>
        <section className="rounded-2xl bg-black/25 p-3 text-xs text-white/70">
          ⌨️ 키보드: 1P <b>A·S·D</b> (또는 1·2·3) · 2P <b>J·K·L</b> (또는 ←·↓·→) · 아이템 <b>Q</b> 방어막 / <b>E</b> 먹물 · <b>ESC</b> 일시정지
        </section>
      </div>
    </Modal>
  );
}
