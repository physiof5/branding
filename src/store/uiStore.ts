import { create } from 'zustand';

export type Screen = 'lobby' | 'customize' | 'battle' | 'shop' | 'pass' | 'road';

export interface Toast {
  id: number;
  text: string;
}

export interface UIState {
  screen: Screen;
  helpOpen: boolean;
  settingsOpen: boolean;
  /** 게임 모드 선택 시트 */
  modeSheetOpen: boolean;
  /** 전투 준비(로드아웃) 시트 */
  loadoutOpen: boolean;
  toast: Toast | null;
  go(screen: Screen): void;
  setHelpOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setModeSheetOpen(open: boolean): void;
  setLoadoutOpen(open: boolean): void;
  showToast(text: string): void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>()((set) => ({
  screen: 'lobby',
  helpOpen: false,
  settingsOpen: false,
  modeSheetOpen: false,
  loadoutOpen: false,
  toast: null,
  go: (screen) => set({ screen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setModeSheetOpen: (modeSheetOpen) => set({ modeSheetOpen }),
  setLoadoutOpen: (loadoutOpen) => set({ loadoutOpen }),
  showToast: (text) => {
    const id = ++toastSeq;
    set({ toast: { id, text } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2200);
  },
}));
