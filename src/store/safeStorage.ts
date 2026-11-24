import { createJSONStorage, type StateStorage } from 'zustand/middleware';

// 사파리 프라이빗 모드/임베드 iframe 등에서 localStorage 접근이 throw 할 수 있다 → 메모리로 폴백
const memory = new Map<string, string>();

const storage: StateStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

export const safeJSONStorage = createJSONStorage(() => storage);
