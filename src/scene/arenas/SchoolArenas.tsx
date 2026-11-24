import type { Draw } from '../textures';
import { fillText } from '../textures';
import { BookStack, Box, Chair, Cyl, Desk, Floor, Lights, Panel } from './kit';

// ── 공통 그리기 ───────────────────────────────────────────────
const planks: Draw = (ctx, w, h) => {
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const shade = [0, 10, -8, 5][r];
    ctx.fillStyle = `rgb(${201 + shade}, ${154 + shade}, ${99 + shade})`;
    ctx.fillRect(0, (r * h) / rows, w, h / rows);
    ctx.fillStyle = 'rgba(90,55,25,0.35)';
    ctx.fillRect(0, (r * h) / rows, w, 3);
    const off = (r % 2) * (w / 2);
    ctx.fillRect((off + w * 0.7) % w, (r * h) / rows, 3, h / rows);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let k = 0; k < 40; k++) ctx.fillRect((k * 53) % w, (k * 97) % h, 30, 2);
};

const chalkboard: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#2f5d45';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let k = 0; k < 30; k++) ctx.fillRect((k * 137) % w, (k * 71) % h, 120, 18);
  fillText(ctx, '급훈', w * 0.12, h * 0.16, 34, 'rgba(255,255,255,0.75)');
  fillText(ctx, '공부는 엉덩이 싸움!', w * 0.5, h * 0.42, 108, '#fdfdf5');
  fillText(ctx, '오늘의 목표: 끝까지 앉아 있기 ✓', w * 0.45, h * 0.73, 44, '#ffe9a8');
  // 칠판 낙서: 복숭아 엉덩이
  ctx.strokeStyle = '#ffc7d6';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(w * 0.86, h * 0.72, 34, 0, Math.PI * 2);
  ctx.arc(w * 0.86 + 58, h * 0.72, 34, 0, Math.PI * 2);
  ctx.stroke();
  fillText(ctx, '3월 2일 (월)  주번: 김엉덩', w * 0.84, h * 0.14, 28, 'rgba(255,255,255,0.7)');
};

const carpet: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#3a4258';
  ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect((k * 37) % w, (k * 91) % h, 2, 2);
  }
};

const quietSign: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#2a0f14';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, '정 숙', w / 2, h / 2, 140, '#ff4d5e', { glow: '#ff4d5e' });
};

const dday: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#081a10';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, '수능 D-100', w / 2, h / 2, 110, '#5dff9b', { glow: '#5dff9b' });
};

const phoneSign: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#f3f1ea';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, '휴대폰은 사물함에!', w / 2, h / 2, 70, '#2a2350');
};

const tiles: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#dfe5ec';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c4ccd6';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, 0, 4, h);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(10, 10, w * 0.4, 6);
};

const banner: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#c62f3a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f7d36b';
  ctx.fillRect(0, 8, w, 6);
  ctx.fillRect(0, h - 14, w, 6);
  fillText(ctx, '축  전국 엉덩이 탐구대회 대상 수상', w / 2, h / 2 + 4, 64, '#fff8e8');
};

const periodic: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#fbfbf7';
  ctx.fillRect(0, 0, w, h);
  const cols = 18;
  const rows = 7;
  const cw = w / (cols + 1);
  const ch = (h - 60) / (rows + 1);
  const pal = ['#ff9f9f', '#ffd18a', '#fff19a', '#a8f0b0', '#9ad8ff', '#c7b2ff'];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c > 0 && c < 17) continue;
      if ((r === 1 || r === 2) && c > 1 && c < 12) continue;
      ctx.fillStyle = pal[(c + r) % pal.length];
      ctx.fillRect(cw * 0.5 + c * cw, 50 + r * ch, cw - 3, ch - 3);
    }
  fillText(ctx, '주기율표', w / 2, 26, 34, '#2a2350');
};

// ── 브론즈: 동네 교실 ─────────────────────────────────────────
export function Classroom() {
  return (
    <>
      <Lights sky="#fff7e8" ground="#a07d55" hemi={1.5} sun={2.6} sunColor="#fff1d6" sunPos={[5, 9, 7]} />
      <Floor draw={planks} repeat={[10, 7]} />
      <Box p={[0, 4, -6]} s={[44, 8, 0.3]} c="#efe6d2" />
      <Box p={[0, 0.55, -5.8]} s={[44, 1.1, 0.1]} c="#93ad86" />
      <Box p={[0, 2.95, -5.8]} s={[7.5, 3.0, 0.12]} c="#8a5a33" />
      <Panel p={[0, 2.95, -5.72]} s={[7.1, 2.6]} draw={chalkboard} w={1024} h={384} />
      <Box p={[0, 1.55, -5.62]} s={[7.1, 0.08, 0.28]} c="#8a5a33" />
      {/* 시계 */}
      <Cyl p={[5.6, 4.9, -5.8]} s={[0.55, 0.12, 0.55]} r={[Math.PI / 2, 0, 0]} c="#fafafa" seg={16} />
      <Box p={[5.6, 5.02, -5.7]} s={[0.05, 0.32, 0.03]} c="#222" />
      <Box p={[5.7, 4.9, -5.7]} s={[0.24, 0.05, 0.03]} c="#222" />
      {/* 창문 */}
      {[8.6, 11.4].map((x) => (
        <group key={x}>
          <Box p={[x, 3.4, -5.82]} s={[2.4, 3.2, 0.12]} c="#f7f4ea" />
          <Box p={[x, 3.4, -5.74]} s={[2.15, 2.95, 0.04]} c="#9fd7ff" e="#bfe6ff" ei={0.55} />
          <Box p={[x, 3.4, -5.7]} s={[0.07, 2.95, 0.05]} c="#f7f4ea" />
        </group>
      ))}
      {/* 교탁 */}
      <Box p={[0, 0.55, -4.3]} s={[1.6, 1.1, 0.7]} c="#a8713f" />
      <Box p={[0, 1.12, -4.3]} s={[1.75, 0.06, 0.8]} c="#c8945a" />
      <BookStack p={[0.4, 1.15, -4.3]} colors={['#e25c5c', '#5c8fe2', '#f2c14e']} />
      {/* 책상/의자 */}
      {[-6.6, -4.4, 4.4, 6.6].map((x) =>
        [-1.6, -3.4].map((z) => (
          <group key={`${x}${z}`}>
            <Desk p={[x, 0, z]} />
            <Chair p={[x, 0, z + 0.55]} r={Math.PI} />
          </group>
        )),
      )}
      <BookStack p={[-4.4, 0.77, -1.6]} colors={['#7ac27a', '#f29f4e']} />
      <BookStack p={[6.6, 0.77, -3.4]} colors={['#c77dff', '#4fb3ff', '#ffd166']} />
    </>
  );
}

// ── 실버: 24시 독서실 ─────────────────────────────────────────
function Cubicle({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.76, 0]} s={[1.45, 0.06, 0.75]} c="#c9b48f" />
      <Box p={[0, 1.15, -0.36]} s={[1.5, 0.8, 0.05]} c="#5b6478" />
      {[-0.73, 0.73].map((sx) => (
        <Box key={sx} p={[sx, 0.95, 0]} s={[0.05, 1.2, 0.78]} c="#5b6478" />
      ))}
      <Box p={[0.45, 1.25, -0.25]} s={[0.04, 0.42, 0.04]} c="#30333c" />
      <Box p={[0.35, 1.45, -0.2]} s={[0.28, 0.07, 0.16]} c="#ffd89a" e="#ffc96b" ei={2.2} cast={false} />
      <Box p={[-0.3, 0.42, 0.42]} s={[0.5, 0.06, 0.45]} c="#2c2f38" />
      <Box p={[-0.3, 0.75, 0.62]} s={[0.5, 0.6, 0.06]} c="#2c2f38" />
      <BookStack p={[-0.35, 0.79, -0.1]} colors={['#e46a6a', '#6a9ae4', '#e4c46a']} />
    </group>
  );
}

export function ReadingRoom() {
  const xs = [-7.2, -5.6, -4.0, 4.0, 5.6, 7.2];
  return (
    <>
      <Lights sky="#8fa0d0" ground="#1f2330" hemi={0.75} sun={1.5} sunColor="#ffe3b0" sunPos={[3, 9, 6]} />
      <pointLight position={[0, 4.2, 1.5]} intensity={22} distance={9} decay={1.6} color="#ffd7a1" />
      <Floor draw={carpet} repeat={[12, 9]} />
      <Box p={[0, 4, -6.2]} s={[44, 8, 0.3]} c="#283044" />
      <Box p={[0, 6.6, -6]} s={[44, 0.25, 0.3]} c="#ffe6b8" e="#ffd590" ei={0.8} cast={false} />
      {xs.map((x) => (
        <Cubicle key={x} x={x} z={-2.2} />
      ))}
      {[-6.4, -4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8, 6.4].map((x) => (
        <Cubicle key={`b${x}`} x={x} z={-4.6} />
      ))}
      <Panel p={[-3.2, 4.1, -6.0]} s={[2.0, 0.9]} draw={quietSign} glow />
      <Panel p={[3.2, 4.1, -6.0]} s={[2.6, 0.9]} draw={dday} glow />
      <Panel p={[8.8, 3.6, -6.0]} s={[2.4, 0.6]} draw={phoneSign} />
    </>
  );
}

// ── 골드: 특목고 복도 ─────────────────────────────────────────
export function ScienceHigh() {
  const lockers = Array.from({ length: 22 }, (_, k) => -9.45 + k * 0.9);
  return (
    <>
      <Lights sky="#ffffff" ground="#9aa7b8" hemi={1.5} sun={2.4} sunColor="#ffffff" sunPos={[4, 10, 7]} />
      <Floor draw={tiles} repeat={[22, 15]} rough={0.35} metal={0.1} />
      <Box p={[0, 4, -6.1]} s={[44, 8, 0.3]} c="#e9eef4" />
      {lockers.map((x, k) => (
        <group key={x} position={[x, 0, -5.65]}>
          <Box p={[0, 1.0, 0]} s={[0.86, 2.0, 0.55]} c={k % 2 ? '#3f6fb5' : '#4a7bc4'} />
          <Box p={[0, 1.65, 0.28]} s={[0.5, 0.04, 0.02]} c="#2b4f86" />
          <Box p={[0, 1.55, 0.28]} s={[0.5, 0.04, 0.02]} c="#2b4f86" />
          <Box p={[0.3, 1.0, 0.29]} s={[0.05, 0.22, 0.04]} c="#c9d3df" metal={0.6} rough={0.3} />
        </group>
      ))}
      <Panel p={[0, 3.35, -5.9]} s={[7.5, 0.9]} draw={banner} w={1024} h={128} />
      <Panel p={[-7.2, 3.7, -5.92]} s={[2.6, 1.6]} draw={periodic} w={512} h={320} />
      {/* 트로피 진열장 */}
      <group position={[7.4, 0, -5.4]}>
        <Box p={[0, 1.3, 0]} s={[2.6, 2.6, 0.7]} c="#8a5a33" />
        <Box p={[0, 1.4, 0.36]} s={[2.4, 2.3, 0.04]} c="#cfeaff" o={0.35} />
        {[0.7, 1.5, 2.3].map((y) => (
          <Box key={y} p={[0, y, 0.05]} s={[2.4, 0.05, 0.55]} c="#c8945a" />
        ))}
        {[-0.8, 0, 0.8].map((x) =>
          [0.72, 1.52].map((y) => (
            <group key={`${x}${y}`} position={[x, y, 0.1]}>
              <Cyl p={[0, 0.06, 0]} s={[0.12, 0.1, 0.12]} c="#8b6b2a" />
              <Cyl p={[0, 0.2, 0]} s={[0.04, 0.2, 0.04]} c="#e8b93a" metal={0.7} rough={0.25} />
              <Cyl p={[0, 0.4, 0]} s={[0.14, 0.2, 0.14]} c="#e8b93a" metal={0.7} rough={0.25} />
            </group>
          )),
        )}
      </group>
      {/* 창 너머 빛 */}
      {[-3, 3].map((x) => (
        <Box key={x} p={[x, 5.1, -5.92]} s={[3.2, 1.2, 0.04]} c="#bfe6ff" e="#d6f0ff" ei={0.7} cast={false} />
      ))}
    </>
  );
}
