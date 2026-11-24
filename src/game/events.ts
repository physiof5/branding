/** 아주 작은 타입 안전 이벤트 버스 (스토어 → 사운드/카메라/이펙트 구독자) */
export type Listener<E> = (event: E) => void;

export interface Emitter<E> {
  emit(event: E): void;
  on(listener: Listener<E>): () => void;
  clear(): void;
}

export function createEmitter<E>(): Emitter<E> {
  const listeners = new Set<Listener<E>>();
  return {
    emit(event) {
      for (const l of [...listeners]) l(event);
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      listeners.clear();
    },
  };
}
