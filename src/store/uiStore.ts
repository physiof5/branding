import { create } from 'zustand';

export type Screen = 'lobby' | 'customize' | 'battle' | 'shop' | 'pass';

export interface Toast {
  id: number;
  text: string;
}

export interface UIState {
  screen: Screen;
  helpOpen: boolean;
  settingsOpen: boolean;
  toast: Toast | null;
  go(screen: Screen): void;
  setHelpOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  showToast(text: string): void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>()((set) => ({
  screen: 'lobby',
  helpOpen: false,
  settingsOpen: false,
  toast: null,
  go: (screen) => set({ screen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  showToast: (text) => {
    const id = ++toastSeq;
    set({ toast: { id, text } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2200);
  },
}));
