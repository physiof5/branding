/** 티어별 3D 배경(맵) 정의 — 실제 지오메트리는 src/scene/arenas/* */
export type MapId = 'classroom' | 'readingRoom' | 'scienceHigh' | 'academyStreet' | 'campus' | 'lab';

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  /** 배경(하늘/벽 너머) 색 */
  sky: string;
  fog: { color: string; near: number; far: number };
}

export const MAPS: Record<MapId, MapDef> = {
  classroom: {
    id: 'classroom',
    name: '평범한 동네 교실',
    subtitle: '분필 가루 날리는 3학년 2반',
    sky: '#cfe8ff',
    fog: { color: '#efe6d2', near: 16, far: 40 },
  },
  readingRoom: {
    id: 'readingRoom',
    name: '24시 독서실',
    subtitle: '정숙! 스탠드 불빛 아래 눈치 싸움',
    sky: '#141a2b',
    fog: { color: '#141a2b', near: 9, far: 26 },
  },
  scienceHigh: {
    id: 'scienceHigh',
    name: '특목고 복도',
    subtitle: '트로피와 사물함 사이의 결투',
    sky: '#dbe6f2',
    fog: { color: '#dbe6f2', near: 14, far: 36 },
  },
  academyStreet: {
    id: 'academyStreet',
    name: '명문 학원가',
    subtitle: '밤 10시, 네온사인 아래',
    sky: '#1a1430',
    fog: { color: '#241a40', near: 10, far: 34 },
  },
  campus: {
    id: 'campus',
    name: '명문대 캠퍼스',
    subtitle: '시계탑 앞 잔디밭 결승전',
    sky: '#9fd3ff',
    fog: { color: '#cfe9ff', near: 18, far: 48 },
  },
  lab: {
    id: 'lab',
    name: '세계 엉덩이 역학 연구소',
    subtitle: '인류의 엉덩이 한계를 시험한다',
    sky: '#0d1b2a',
    fog: { color: '#10243a', near: 12, far: 36 },
  },
};

export const MAP_ORDER: readonly MapId[] = ['classroom', 'readingRoom', 'scienceHigh', 'academyStreet', 'campus', 'lab'];
