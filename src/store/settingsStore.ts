import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MapId } from '../data/maps';
import type { MatchKind } from '../game/rewards';
import type { PartnerKind } from './matchmaking';
import { safeJSONStorage } from './safeStorage';

/** 마지막으로 고른 모드/팀 구성 (전투 버튼·전투 준비 화면 기본값) */
export interface ModePrefs {
  mode: MatchKind;
  queue: 'solo' | 'duo';
  partySize: number;
  partners: PartnerKind[];
  localMap: MapId;
}

export interface SettingsState {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** 카메라 쉐이크 강도 0~1 (멀미 방지 옵션) */
  cameraShake: number;
  modePrefs: ModePrefs;
  setModePrefs(patch: Partial<ModePrefs>): void;
  setVolume(kind: 'masterVolume' | 'bgmVolume' | 'sfxVolume', value: number): void;
  toggleMute(): void;
  setCameraShake(value: number): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterVolume: 0.8,
      bgmVolume: 0.45,
      sfxVolume: 0.9,
      muted: false,
      cameraShake: 1,
      modePrefs: { mode: 'ranked', queue: 'solo', partySize: 2, partners: ['ai', 'ai'], localMap: 'classroom' },
      setModePrefs: (patch) => set((st) => ({ modePrefs: { ...st.modePrefs, ...patch } })),
      setVolume: (kind, value) => set({ [kind]: Math.max(0, Math.min(1, value)) } as Pick<SettingsState, typeof kind>),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setCameraShake: (value) => set({ cameraShake: Math.max(0, Math.min(1, value)) }),
    }),
    {
      name: 'sbb-settings',
      storage: safeJSONStorage,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, modePrefs: { ...current.modePrefs, ...p.modePrefs } };
      },
    },
  ),
);
