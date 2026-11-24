import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from './safeStorage';

export interface SettingsState {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** 카메라 쉐이크 강도 0~1 (멀미 방지 옵션) */
  cameraShake: number;
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
      setVolume: (kind, value) => set({ [kind]: Math.max(0, Math.min(1, value)) } as Pick<SettingsState, typeof kind>),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setCameraShake: (value) => set({ cameraShake: Math.max(0, Math.min(1, value)) }),
    }),
    { name: 'sbb-settings', storage: safeJSONStorage, version: 1 },
  ),
);
