/** 기 모으기 오라/스택 구슬 색 — 외형 전용 (성능 영향 없음) */
export type EffectId = 'basic' | 'sakura' | 'gold' | 'galaxy' | 'rainbow';

export interface EffectDef {
  id: EffectId;
  name: string;
  description: string;
  colors: readonly [string, string];
  rainbow?: boolean;
}

export const EFFECTS: Record<EffectId, EffectDef> = {
  basic: { id: 'basic', name: '열정 오라', description: '기본 주황 불꽃', colors: ['#ffb347', '#ff6b3d'] },
  sakura: { id: 'sakura', name: '벚꽃 엉덩이', description: '흩날리는 분홍 꽃잎', colors: ['#ffc4dd', '#ff7eb3'] },
  gold: { id: 'gold', name: '황금 오라', description: '전교 1등의 금빛', colors: ['#fff09a', '#ffbe0b'] },
  galaxy: { id: 'galaxy', name: '은하수 오라', description: '밤샘 공부의 별빛', colors: ['#b7a6ff', '#43d6ff'] },
  rainbow: { id: 'rainbow', name: '무지개 오라', description: '7과목 올 1등급', colors: ['#ff6b6b', '#6bffb0'], rainbow: true },
};

export const EFFECT_ORDER: readonly EffectId[] = ['basic', 'sakura', 'gold', 'galaxy', 'rainbow'];
