import type { MatchKind } from '../game/rewards';

export interface ModeDef {
  id: MatchKind;
  name: string;
  tagline: string;
  desc: string;
  emoji: string;
  /** 카드 그라데이션 */
  colors: readonly [string, string];
}

/** 게임 모드 (LoL 식 큐 구분을 1:1 엉덩이 배틀에 맞춘 구성) */
export const MODES: Record<MatchKind, ModeDef> = {
  ranked: {
    id: 'ranked',
    name: '클래식 랭크전',
    tagline: '개인/2인 랭크 · 솔로·듀오',
    desc: '혼자 또는 파트너 1명과 함께 티어를 올리는 대표 랭크 모드. 듀오는 2:2 릴레이 대결이에요.',
    emoji: '🏆',
    colors: ['#4da3ff', '#2f6fe0'],
  },
  flex: {
    id: 'flex',
    name: '자유 랭크전',
    tagline: '1~3인 파티 · 팀 랭크',
    desc: '1~3인 파티를 꾸려 팀 단위로 겨루는 랭크 모드. 한 명씩 나가 싸우고, 쓰러지면 다음 주자가 이어받아요.',
    emoji: '🤝',
    colors: ['#a78bfa', '#7045e0'],
  },
  challenge: {
    id: 'challenge',
    name: '클래식 도전',
    tagline: '하루 10판 · 이길 때마다 아이템',
    desc: '하루 10판까지 도전! 이길 때마다 방어막·먹물·기폭제 중 하나를 받아요. 상대 AI 가 한 단계 강해요.',
    emoji: '🎯',
    colors: ['#ff9a5c', '#e5487a'],
  },
  local: {
    id: 'local',
    name: '클래식 1v1',
    tagline: '한 기기 2인 · 친선전',
    desc: '한 화면에서 둘이 동시에 몰래 고르는 친선전. 누른 버튼은 상대에게 안 보여요.',
    emoji: '👥',
    colors: ['#3ccf8e', '#17946b'],
  },
};

export const MODE_ORDER: readonly MatchKind[] = ['ranked', 'flex', 'challenge', 'local'];
