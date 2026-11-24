import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GEO } from '../geometries';
import type { Draw } from '../textures';
import { fillText } from '../textures';
import { Ball, Box, Cone, Cyl, Floor, Lights, Panel, Tree } from './kit';

// ── 그리기 ───────────────────────────────────────────────────
const sidewalk: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#4b4e60';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3b3d4c';
  ctx.fillRect(0, h / 2 - 2, w, 4);
  ctx.fillRect(w / 2 - 2, 0, 4, h);
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, 0, 4, h);
};

const windows: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#23253b';
  ctx.fillRect(0, 0, w, h);
  const cols = 6;
  const rows = 12;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const lit = (r * 7 + c * 13) % 5 !== 0;
      ctx.fillStyle = lit ? ((r + c) % 3 === 0 ? '#bfe3ff' : '#ffe2a3') : '#151627';
      ctx.fillRect(8 + c * (w / cols), 8 + r * (h / rows), w / cols - 16, h / rows - 14);
    }
};

const neon =
  (text: string, color: string, bg = '#120c22'): Draw =>
  (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.shadowBlur = 0;
    fillText(ctx, text, w / 2, h / 2 + 4, Math.min(110, (w * 1.55) / text.length), '#ffffff', { glow: color });
  };
const neonMed = neon('의대 입시반', '#ff4fa3');
const neonMath = neon('수학 1타 강사', '#2fe0ff');
const neonCafe = neon('24시 스터디카페', '#ffe14f');
const neonEssay = neon('논술·면접 특강', '#6dff8a');

const grass: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#7cbf5a';
  ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 500; k++) {
    ctx.fillStyle = k % 3 ? 'rgba(40,90,30,0.18)' : 'rgba(255,255,200,0.12)';
    ctx.fillRect((k * 53) % w, (k * 29) % h, 3, 7);
  }
};

const campusBanner: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#1f3c88';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, '축 합격! 엉덩이로 이룬 꿈', w / 2, h / 2 + 4, 62, '#ffffff', { stroke: '#0e1f4d', strokeWidth: 6 });
};

const clockFace: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#fbf7ea';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 6;
  ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(w / 2 + Math.sin(a) * (w * 0.38) - 4, h / 2 - Math.cos(a) * (h * 0.38) - 4, 8, 8);
  }
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w / 2, h * 0.2);
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w * 0.7, h * 0.58);
  ctx.stroke();
};

const labGrid: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#0f1c2c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2fd6ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#2fd6ff';
  ctx.shadowBlur = 8;
  ctx.strokeRect(0, 0, w, h);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
};

const holo =
  (title: string, lines: string[], color: string): Draw =>
  (ctx, w, h) => {
    ctx.fillStyle = 'rgba(10, 40, 70, 0.75)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    fillText(ctx, title, w / 2, 48, 40, color, { glow: color });
    lines.forEach((l, k) => fillText(ctx, l, w / 2, 120 + k * 64, 46, '#e8fbff', { glow: color }));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 30; x < w - 30; x += 6) {
      const y = h - 60 - Math.sin(x * 0.03) * 22 - x * 0.06;
      if (x === 30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
const holoA = holo('엉덩이 역학 제1법칙', ['∫ 엉덩이 dt = 합격', 'F = m · a(엉덩이)'], '#2fe0ff');
const holoB = holo('실험 로그 #1004', ['착석 지속력 99.8%', '집중도 ▲ 1등급'], '#b98cff');
const labSign: Draw = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  fillText(ctx, '세계 엉덩이 역학 연구소', w / 2, h / 2, 84, '#e8fbff', { glow: '#2fe0ff' });
};

// ── 플래티넘: 명문 학원가 (밤) ─────────────────────────────────
export function AcademyStreet() {
  const buildings: { x: number; w: number; h: number; c: string }[] = [
    { x: -11, w: 4.2, h: 9, c: '#2b2d48' },
    { x: -6.6, w: 4.2, h: 11.5, c: '#33355a' },
    { x: -2.2, w: 4.2, h: 8.5, c: '#2d3050' },
    { x: 2.2, w: 4.2, h: 12, c: '#363a62' },
    { x: 6.6, w: 4.2, h: 9.5, c: '#2b2d48' },
    { x: 11, w: 4.2, h: 11, c: '#33355a' },
  ];
  return (
    <>
      <Lights sky="#6b5bb0" ground="#1a1426" hemi={0.9} sun={1.4} sunColor="#c9c0ff" sunPos={[-4, 10, 6]} />
      <pointLight position={[-3.5, 3, 0.5]} intensity={14} distance={9} decay={1.5} color="#ff4fa3" />
      <pointLight position={[3.5, 3, 0.5]} intensity={14} distance={9} decay={1.5} color="#2fe0ff" />
      <Floor draw={sidewalk} repeat={[14, 10]} rough={0.7} />
      <Box p={[0, 0.06, -4.2]} s={[44, 0.12, 0.35]} c="#8c8fa0" />
      <Box p={[0, 0.01, -5.6]} s={[44, 0.02, 2.4]} c="#2a2b36" />
      {buildings.map((b) => (
        <group key={b.x} position={[b.x, 0, -9]}>
          <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, 2.5]} c={b.c} />
          <Panel p={[0, b.h / 2 + 0.6, 1.27]} s={[b.w - 0.5, b.h - 2.5]} draw={windows} w={256} h={512} glow glowIntensity={0.85} />
        </group>
      ))}
      <Panel p={[-6.6, 3.0, -7.6]} s={[3.6, 1.1]} draw={neonMed} glow glowIntensity={1.6} />
      <Panel p={[2.2, 3.2, -7.6]} s={[3.6, 1.1]} draw={neonMath} glow glowIntensity={1.6} />
      <Panel p={[-2.2, 2.4, -7.6]} s={[3.4, 0.9]} draw={neonCafe} glow glowIntensity={1.5} />
      <Panel p={[6.6, 2.6, -7.6]} s={[3.4, 0.9]} draw={neonEssay} glow glowIntensity={1.5} />
      {[-6, 6].map((x) => (
        <group key={x} position={[x, 0, -2.6]}>
          <Cyl p={[0, 1.7, 0]} s={[0.07, 3.4, 0.07]} c="#2b2b33" metal={0.5} />
          <Box p={[0, 3.45, 0.25]} s={[0.25, 0.12, 0.6]} c="#2b2b33" />
          <Box p={[0, 3.36, 0.4]} s={[0.2, 0.05, 0.4]} c="#fff4c9" e="#ffe8a0" ei={2.5} cast={false} />
        </group>
      ))}
    </>
  );
}

// ── 다이아: 명문대 캠퍼스 ─────────────────────────────────────
export function Campus() {
  return (
    <>
      <Lights sky="#cfeaff" ground="#6aa84f" hemi={1.5} sun={2.9} sunColor="#fff6e0" sunPos={[6, 12, 8]} />
      <Floor draw={grass} repeat={[16, 11]} />
      <Box p={[0, 0.015, -3]} s={[3.6, 0.03, 30]} c="#d9cfc4" receive />
      {/* 시계탑 */}
      <group position={[0, 0, -10]}>
        <Box p={[0, 3.5, 0]} s={[3, 7, 3]} c="#a5543c" />
        <Box p={[0, 8.0, 0]} s={[2.4, 2.0, 2.4]} c="#b9634a" />
        <Cone four p={[0, 10.0, 0]} s={[1.9, 2.0, 1.9]} r={[0, Math.PI / 4, 0]} c="#2f5d50" />
        <Panel p={[0, 8.0, 1.22]} s={[1.6, 1.6]} draw={clockFace} w={256} h={256} />
        {[-1, 0, 1].map((k) => (
          <Box key={k} p={[k * 0.9, 1.0, 1.52]} s={[0.5, 2.0, 0.05]} c="#5a2a1c" />
        ))}
      </group>
      {[-8.5, 8.5].map((x) => (
        <group key={x} position={[x, 0, -8.5]}>
          <Box p={[0, 2.6, 0]} s={[7, 5.2, 3]} c="#b35d42" />
          <Box p={[0, 5.4, 0]} s={[7.4, 0.4, 3.4]} c="#efe6d6" />
          {[-2.6, -1.3, 0, 1.3, 2.6].map((cx) => (
            <Cyl key={cx} p={[cx, 1.8, 1.65]} s={[0.22, 3.6, 0.22]} c="#f4efe4" seg={8} />
          ))}
        </group>
      ))}
      <Panel p={[0, 3.1, -8.4]} s={[5.4, 0.9]} draw={campusBanner} w={1024} h={160} />
      {[
        [-6.5, -2.5],
        [6.5, -2.5],
        [-9.5, -4.5],
        [9.5, -4.5],
        [-4.2, -5.2],
        [4.2, -5.2],
      ].map(([x, z]) => (
        <Tree key={`${x}${z}`} p={[x, 0, z]} s={1.05} />
      ))}
      {[-3.8, 3.8].map((x) => (
        <group key={x} position={[x, 0, -1.8]}>
          <Box p={[0, 0.45, 0]} s={[1.6, 0.08, 0.5]} c="#9b6a3c" />
          <Box p={[0, 0.75, -0.22]} s={[1.6, 0.4, 0.06]} c="#9b6a3c" />
          {[-0.7, 0.7].map((lx) => (
            <Box key={lx} p={[lx, 0.22, 0]} s={[0.06, 0.45, 0.45]} c="#3a3a40" />
          ))}
        </group>
      ))}
    </>
  );
}

// ── 마스터: 세계 엉덩이 역학 연구소 ───────────────────────────
function DnaHelix({ p }: { p: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      a: new THREE.MeshStandardMaterial({ color: '#2fe0ff', emissive: '#2fe0ff', emissiveIntensity: 1.2, flatShading: true }),
      b: new THREE.MeshStandardMaterial({ color: '#ff5fd2', emissive: '#ff5fd2', emissiveIntensity: 1.2, flatShading: true }),
      rod: new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: '#9fdfff', emissiveIntensity: 0.5 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.6;
  });
  const n = 16;
  return (
    <group ref={group} position={p}>
      {Array.from({ length: n }, (_, k) => {
        const y = 0.3 + k * 0.32;
        const a = k * 0.55;
        return (
          <group key={k} position={[0, y, 0]} rotation={[0, a, 0]}>
            <mesh geometry={GEO.ico0} material={mats.a} position={[0.55, 0, 0]} scale={0.11} />
            <mesh geometry={GEO.ico0} material={mats.b} position={[-0.55, 0, 0]} scale={0.11} />
            <mesh geometry={GEO.cyl6} material={mats.rod} rotation={[0, 0, Math.PI / 2]} scale={[0.025, 1.1, 0.025]} />
          </group>
        );
      })}
    </group>
  );
}

function ServerRack({ x }: { x: number }) {
  const leds = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (leds.current) leds.current.emissiveIntensity = 0.8 + Math.abs(Math.sin(clock.elapsedTime * 3 + x)) * 1.6;
  });
  return (
    <group position={[x, 0, -5.4]}>
      <mesh geometry={GEO.box} position={[0, 1.4, 0]} scale={[1.0, 2.8, 0.8]} castShadow receiveShadow>
        <meshStandardMaterial color="#1c2534" flatShading metalness={0.4} roughness={0.5} />
      </mesh>
      {[0.6, 1.0, 1.4, 1.8, 2.2].map((y) => (
        <mesh key={y} geometry={GEO.box} position={[0, y, 0.41]} scale={[0.8, 0.05, 0.02]}>
          <meshStandardMaterial ref={y === 0.6 ? leds : undefined} color="#5dff9b" emissive="#5dff9b" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

export function ResearchLab() {
  return (
    <>
      <Lights sky="#bfe8ff" ground="#16233a" hemi={1.0} sun={2.0} sunColor="#e8f6ff" sunPos={[4, 10, 6]} />
      <pointLight position={[0, 0.6, 1.5]} intensity={10} distance={7} decay={1.6} color="#2fe0ff" />
      <Floor draw={labGrid} repeat={[18, 12]} rough={0.35} metal={0.35} emissive />
      <Cyl p={[0, 0.05, 0]} s={[3.4, 0.1, 2.2]} c="#22364d" seg={16} metal={0.4} rough={0.4} />
      <mesh geometry={GEO.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]} scale={[3.45, 2.25, 1]}>
        <meshBasicMaterial color="#2fe0ff" toneMapped={false} />
      </mesh>
      <Box p={[0, 4, -6.2]} s={[44, 8, 0.3]} c="#13243a" />
      {[-9, -4.5, 4.5, 9].map((x) => (
        <Box key={x} p={[x, 4, -6.0]} s={[0.12, 8, 0.1]} c="#2fe0ff" e="#2fe0ff" ei={1.4} cast={false} />
      ))}
      <Panel p={[-3.4, 3.4, -5.9]} s={[3.8, 2.4]} draw={holoA} w={640} h={400} glow glowIntensity={1.1} />
      <Panel p={[3.4, 3.4, -5.9]} s={[3.8, 2.4]} draw={holoB} w={640} h={400} glow glowIntensity={1.1} />
      <Panel p={[0, 6.4, -5.95]} s={[9, 1.1]} draw={labSign} w={1024} h={128} glow glowIntensity={1.3} />
      <DnaHelix p={[-7.4, 0, -3.6]} />
      {[6.2, 7.3, 8.4].map((x) => (
        <ServerRack key={x} x={x} />
      ))}
      {[-5.2, -4.4].map((x, k) => (
        <group key={x} position={[x, 0, -4.6]}>
          <Cyl p={[0, 1.1, 0]} s={[0.32, 2.2, 0.32]} c="#cfefff" o={0.25} seg={12} />
          <Cyl p={[0, 0.75, 0]} s={[0.28, 1.4, 0.28]} c={k ? '#ff5fd2' : '#5dff9b'} e={k ? '#ff5fd2' : '#5dff9b'} ei={0.9} seg={12} />
          <Cyl p={[0, 2.25, 0]} s={[0.36, 0.1, 0.36]} c="#5b6b80" seg={12} />
          <Ball p={[0, 1.6, 0]} s={0.06} c="#ffffff" e="#ffffff" ei={1.5} />
        </group>
      ))}
    </>
  );
}
