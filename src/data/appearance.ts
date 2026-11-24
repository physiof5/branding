import type { CostumeId } from './costumes';
import type { EffectId } from './effects';

export type HairStyleId = 'bald' | 'buzz' | 'sidePart' | 'bowl' | 'bun' | 'curly';

export interface Appearance {
  skin: string;
  hairStyle: HairStyleId;
  hairColor: string;
  /** 0 = 마름 ~ 1 = 통통 */
  bodyType: number;
  /** 0 = 작음 ~ 1 = 큼 */
  height: number;
  /** 0 = 납작 ~ 1 = 초빵빵 (외형 전용!) */
  buttVolume: number;
  costumeId: CostumeId;
  effectId: EffectId;
}

export const HAIR_STYLES: readonly { id: HairStyleId; name: string }[] = [
  { id: 'bald', name: '민머리' },
  { id: 'buzz', name: '까까머리' },
  { id: 'sidePart', name: '2:8 가르마' },
  { id: 'bowl', name: '바가지' },
  { id: 'bun', name: '똥머리' },
  { id: 'curly', name: '뽀글 파마' },
];

export const SKIN_TONES: readonly { name: string; color: string }[] = [
  { name: '기본 (레퍼런스)', color: '#ecc8b8' },
  { name: '밝은 톤', color: '#f8dfd0' },
  { name: '황금빛', color: '#e3b38d' },
  { name: '구릿빛', color: '#c48a61' },
  { name: '브라운', color: '#8d5a3b' },
  { name: '딥 브라운', color: '#5e3b29' },
];

export const HAIR_COLORS: readonly { name: string; color: string }[] = [
  { name: '흑발', color: '#2b2730' },
  { name: '갈색', color: '#5a3a28' },
  { name: '밀크브라운', color: '#b07b46' },
  { name: '금발', color: '#e6cd74' },
  { name: '핑크', color: '#e46a8f' },
  { name: '블루', color: '#5a8fe6' },
];

/** 사용자 레퍼런스 캐릭터 (민머리 · 네이비 스크럽 · 빨간 입술) */
export const DEFAULT_APPEARANCE: Appearance = {
  skin: '#ecc8b8',
  hairStyle: 'bald',
  hairColor: '#2b2730',
  bodyType: 0.4,
  height: 0.5,
  buttVolume: 0.45,
  costumeId: 'scrubs',
  effectId: 'basic',
};

/** 엉덩이 볼륨 슬라이더 → 3D 스케일 */
export const buttScale = (v: number): number => 0.55 + clamp01(v) * 1.45;

export function buttLabel(v: number): string {
  if (v < 0.2) return '납작';
  if (v < 0.45) return '아담';
  if (v < 0.7) return '빵빵';
  if (v < 0.9) return '왕빵빵';
  return '전설의 엉덩이';
}

export function bodyLabel(v: number): string {
  if (v < 0.25) return '슬림';
  if (v < 0.6) return '보통';
  if (v < 0.85) return '통통';
  return '든든';
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function randomAppearance(rng: () => number, costumes: readonly CostumeId[], effects: readonly EffectId[] = ['basic']): Appearance {
  const pickOne = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length];
  return {
    skin: pickOne(SKIN_TONES).color,
    hairStyle: pickOne(HAIR_STYLES).id,
    hairColor: pickOne(HAIR_COLORS).color,
    bodyType: Math.round(rng() * 100) / 100,
    height: Math.round((0.2 + rng() * 0.6) * 100) / 100,
    buttVolume: Math.round((0.25 + rng() * 0.75) * 100) / 100,
    costumeId: pickOne(costumes),
    effectId: pickOne(effects),
  };
}

/** AI 상대 이름 풀 */
export const RIVAL_NAMES: readonly string[] = [
  '전교1등 김엉덩',
  '수학귀신 박빵빵',
  '독서실 지박령',
  '밤샘의 신 최궁디',
  '오답노트 장인',
  '형광펜 수집가',
  '모의고사 만점러',
  '의자 붙박이 이씨',
  '단어장 무한반복',
  '엉덩이 무쇠 정씨',
];
