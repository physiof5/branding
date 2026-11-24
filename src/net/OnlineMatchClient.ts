import { createEmitter } from '../game/events';
import type { ClientMessage, PublicProfile, ServerMessage } from './protocol';

/**
 * 온라인 매칭 클라이언트 골격 (WebSocket).
 * 서버는 아직 포함되지 않았다 — Supabase Realtime / Colyseus / 자체 ws 서버 어느 쪽이든
 * protocol.ts 메시지만 맞추면 붙일 수 있다.
 *
 * 배틀 스토어 연결 방법 (예정):
 *  - 'matched'        → useBattleStore.start({ ..., fighters: [me(human), opponent(remote)] })
 *  - 'opponentLocked' → HUD '선택 완료' 표시
 *  - 'reveal'         → useBattleStore.choose(opponentIndex, action, 'remote')
 */
export class OnlineMatchClient {
  private ws: WebSocket | null = null;
  readonly events = createEmitter<ServerMessage>();

  constructor(private readonly url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('매칭 서버에 연결할 수 없어요'));
      ws.onmessage = (ev) => {
        try {
          this.events.emit(JSON.parse(String(ev.data)) as ServerMessage);
        } catch {
          /* 잘못된 메시지는 무시 */
        }
      };
      ws.onclose = () => (this.ws = null);
      this.ws = ws;
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  queue(profile: PublicProfile): void {
    this.send({ t: 'queue', profile });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.events.clear();
  }
}
