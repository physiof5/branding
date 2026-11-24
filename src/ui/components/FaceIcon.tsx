import type { Appearance } from '../../data/appearance';

/** HUD/로비용 2D 얼굴 아이콘 — 3D 캐릭터와 같은 외형 데이터를 사용 */
export function FaceIcon({ appearance, size = 48, flip = false, className = '' }: { appearance: Appearance; size?: number; flip?: boolean; className?: string }) {
  const { skin, hairColor: hc, hairStyle } = appearance;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
      <ellipse cx="11" cy="56" rx="7" ry="10" fill={skin} stroke="#1b1633" strokeWidth="3" />
      <ellipse cx="89" cy="56" rx="7" ry="10" fill={skin} stroke="#1b1633" strokeWidth="3" />
      <circle cx="50" cy="53" r="41" fill={skin} stroke="#1b1633" strokeWidth="3.5" />
      {hairStyle === 'bald' && <ellipse cx="38" cy="26" rx="10" ry="5" fill="#ffffff" opacity="0.35" transform="rotate(-20 38 26)" />}
      {(hairStyle === 'buzz' || hairStyle === 'bun' || hairStyle === 'sidePart') && (
        <path d="M11 47 C14 16 86 16 89 47 C76 33 24 33 11 47 Z" fill={hc} stroke="#1b1633" strokeWidth="3" strokeLinejoin="round" />
      )}
      {hairStyle === 'sidePart' && <path d="M30 26 C48 14 74 18 84 34 C66 28 46 30 30 26 Z" fill={hc} stroke="#1b1633" strokeWidth="3" />}
      {hairStyle === 'bun' && <circle cx="50" cy="11" r="10" fill={hc} stroke="#1b1633" strokeWidth="3" />}
      {hairStyle === 'bowl' && (
        <path d="M8 52 C8 8 92 8 92 52 L92 40 C70 32 30 32 8 40 Z" fill={hc} stroke="#1b1633" strokeWidth="3" strokeLinejoin="round" />
      )}
      {hairStyle === 'curly' &&
        [14, 26, 38, 50, 62, 74, 86].map((x, k) => (
          <circle key={x} cx={x} cy={k % 2 ? 22 : 30 - Math.abs(50 - x) * 0.25} r="11" fill={hc} stroke="#1b1633" strokeWidth="2.5" />
        ))}
      <rect x="25" y="37" width="19" height="6.5" rx="3" fill="#2e2e3c" />
      <rect x="56" y="37" width="19" height="6.5" rx="3" fill="#2e2e3c" />
      <ellipse cx="35" cy="52" rx="5.5" ry="6.5" fill="#1b1a24" />
      <ellipse cx="65" cy="52" rx="5.5" ry="6.5" fill="#1b1a24" />
      <circle cx="37" cy="49.5" r="1.8" fill="#fff" />
      <circle cx="67" cy="49.5" r="1.8" fill="#fff" />
      <ellipse cx="22" cy="64" rx="7" ry="4" fill="#f2959a" opacity="0.85" />
      <ellipse cx="78" cy="64" rx="7" ry="4" fill="#f2959a" opacity="0.85" />
      <ellipse cx="50" cy="60" rx="4.5" ry="5.5" fill="#000" opacity="0.08" />
      <ellipse cx="50" cy="77" rx="14" ry="6.5" fill="#dc625e" stroke="#1b1633" strokeWidth="2" />
      <path d="M36 74 C40 66 48 68 50 71 C52 68 60 66 64 74 C56 76 44 76 36 74 Z" fill="#c4554f" stroke="#1b1633" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
