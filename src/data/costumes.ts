/**
 * 코스튬 카탈로그 — 지역별/학교별 테마 구조.
 * 새 테마는 여기 데이터만 추가하면 상점·패스·커스터마이저·3D 모델에 자동 반영된다.
 */
export type CostumeId =
  | 'scrubs'
  | 'uniform'
  | 'tracksuit'
  | 'hoodie'
  | 'marine'
  | 'jeju'
  | 'seonbi'
  | 'labcoat'
  | 'goldScrubs';

export type TopStyle = 'vneck' | 'blazer' | 'zip' | 'hoodie' | 'stripe' | 'tee' | 'robe' | 'coat';
export type Accessory = 'badge' | 'tie' | 'headband' | 'tangerineHat' | 'sailorHat' | 'gat' | 'goggles';
export type CostumeThemeKind = 'basic' | 'school' | 'region' | 'pass';

export interface CostumeDef {
  id: CostumeId;
  name: string;
  description: string;
  theme: { kind: CostumeThemeKind; label: string };
  /** null 이면 상점 판매 X (시즌 패스 보상) */
  price: number | null;
  topStyle: TopStyle;
  top: string;
  topAccent: string;
  bottom: string;
  bottomStripe?: string;
  shoes: string;
  accessories: readonly Accessory[];
  metallic?: boolean;
}

export const COSTUMES: Record<CostumeId, CostumeDef> = {
  scrubs: {
    id: 'scrubs',
    name: '기본 스크럽',
    description: '사원증까지 챙긴 성실한 네이비 스크럽',
    theme: { kind: 'basic', label: '기본' },
    price: 0,
    topStyle: 'vneck',
    // 기본 캐릭터 디자인 시트에서 측정한 색
    top: '#62647f',
    topAccent: '#4f5170',
    bottom: '#5e607c',
    shoes: '#38373e',
    accessories: ['badge'],
  },
  uniform: {
    id: 'uniform',
    name: '동네고 교복',
    description: '넥타이 꽉 맨 모범생 블레이저',
    theme: { kind: 'school', label: '동네고등학교' },
    price: 300,
    topStyle: 'blazer',
    top: '#2b3a67',
    topAccent: '#f3f3f0',
    bottom: '#5d6270',
    shoes: '#1f1f24',
    accessories: ['tie'],
  },
  tracksuit: {
    id: 'tracksuit',
    name: '체육대회 체육복',
    description: '필승 머리띠 + 삼선 체육복',
    theme: { kind: 'school', label: '체육대회' },
    price: 250,
    topStyle: 'zip',
    top: '#2f8f5b',
    topAccent: '#ffffff',
    bottom: '#2f8f5b',
    bottomStripe: '#ffffff',
    shoes: '#f2f2f2',
    accessories: ['headband'],
  },
  hoodie: {
    id: 'hoodie',
    name: '학원가 후드티',
    description: '새벽 2시 귀가 국룰 회색 후드',
    theme: { kind: 'region', label: '대치동 학원가' },
    price: 350,
    topStyle: 'hoodie',
    top: '#8b909b',
    topAccent: '#6c717c',
    bottom: '#2a2b30',
    shoes: '#e9e9e9',
    accessories: [],
  },
  marine: {
    id: 'marine',
    name: '부산 바다 마린룩',
    description: '광안리 바닷바람 스트라이프',
    theme: { kind: 'region', label: '부산' },
    price: 450,
    topStyle: 'stripe',
    top: '#ffffff',
    topAccent: '#2c5aa0',
    bottom: '#2c3e63',
    shoes: '#ffffff',
    accessories: ['sailorHat'],
  },
  jeju: {
    id: 'jeju',
    name: '제주 감귤단',
    description: '새콤달콤 감귤 모자 세트',
    theme: { kind: 'region', label: '제주' },
    price: 450,
    topStyle: 'tee',
    top: '#f39a2b',
    topAccent: '#4d9a43',
    bottom: '#3c6e47',
    shoes: '#f3efe6',
    accessories: ['tangerineHat'],
  },
  seonbi: {
    id: 'seonbi',
    name: '안동 선비 도포',
    description: '갓 쓰고 정좌, 엉덩이 싸움의 원조',
    theme: { kind: 'pass', label: '안동 · 패스 무료 15' },
    price: null,
    topStyle: 'robe',
    top: '#eef1f4',
    topAccent: '#33415c',
    bottom: '#e4e8ee',
    shoes: '#2a2a2a',
    accessories: ['gat'],
  },
  labcoat: {
    id: 'labcoat',
    name: '연구원 가운',
    description: '세계 엉덩이 역학 연구소 정식 연구원',
    theme: { kind: 'pass', label: '로열 패스 10' },
    price: null,
    topStyle: 'coat',
    top: '#f7f9fb',
    topAccent: '#3b3f66',
    bottom: '#3d4060',
    shoes: '#2e2d33',
    accessories: ['goggles', 'badge'],
  },
  goldScrubs: {
    id: 'goldScrubs',
    name: '황금 스크럽',
    description: '시즌 1 로열 패스 최종 보상',
    theme: { kind: 'pass', label: '로열 패스 20' },
    price: null,
    topStyle: 'vneck',
    top: '#e2b33c',
    topAccent: '#c4942a',
    bottom: '#c99a2e',
    shoes: '#3a2a10',
    accessories: ['badge'],
    metallic: true,
  },
};

export const COSTUME_ORDER: readonly CostumeId[] = [
  'scrubs',
  'uniform',
  'tracksuit',
  'hoodie',
  'marine',
  'jeju',
  'seonbi',
  'labcoat',
  'goldScrubs',
];
