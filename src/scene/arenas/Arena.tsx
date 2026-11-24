import type { MapId } from '../../data/maps';
import { AcademyStreet, Campus, ResearchLab } from './CityArenas';
import { Classroom, ReadingRoom, ScienceHigh } from './SchoolArenas';

/** 티어별 맵 자동 전환 — mapId 는 랭크(트로피)에서 결정된다 (game/rank.ts) */
export function Arena({ id }: { id: MapId }) {
  switch (id) {
    case 'classroom':
      return <Classroom />;
    case 'readingRoom':
      return <ReadingRoom />;
    case 'scienceHigh':
      return <ScienceHigh />;
    case 'academyStreet':
      return <AcademyStreet />;
    case 'campus':
      return <Campus />;
    case 'lab':
      return <ResearchLab />;
  }
}
