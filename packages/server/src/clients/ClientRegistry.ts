import { randomUUID } from "node:crypto";
import type { PaneId, TabId, WorkspaceId } from "@wtm/protocol";

export type ClientKind = "desktop" | "mobile";

export interface ClientView {
  workspaceId: WorkspaceId;
  tabId: TabId;
  visible: { paneId: PaneId; cols: number; rows: number }[];
}

export interface ClientRecord {
  readonly id: string;
  kind: ClientKind;
  fit: boolean;
  view: ClientView | null;
  lastInteractionAt: number;
  readonly subscriptions: Set<PaneId>;
}

/** 接続中のクライアント（architecture.md「ClientRegistry」）。 */
export interface ClientRegistry {
  /**
   * 接続を受けた時点で呼ぶ（`kind` はまだ分からないので既定値。`client.hello` が届いたら
   * `setKind` で確定する。architecture.md の接続シーケンス：`register()` が先、`client.hello` は後）。
   */
  register(kind?: ClientKind): string;
  unregister(clientId: string): void;
  get(clientId: string): ClientRecord | undefined;
  list(): ClientRecord[];
  setKind(clientId: string, kind: ClientKind): void;
  setView(clientId: string, view: ClientView): void;
  setFit(clientId: string, on: boolean): void;
  touch(clientId: string): void;
  addSubscription(clientId: string, paneId: PaneId): void;
  removeSubscription(clientId: string, paneId: PaneId): void;
  subscriptions(clientId: string): PaneId[];
}

export class DefaultClientRegistry implements ClientRegistry {
  private readonly clients = new Map<string, ClientRecord>();

  register(kind: ClientKind = "desktop"): string {
    const id = randomUUID();
    this.clients.set(id, { id, kind, fit: false, view: null, lastInteractionAt: Date.now(), subscriptions: new Set() });
    return id;
  }

  unregister(clientId: string): void {
    this.clients.delete(clientId);
  }

  get(clientId: string): ClientRecord | undefined {
    return this.clients.get(clientId);
  }

  list(): ClientRecord[] {
    return [...this.clients.values()];
  }

  setKind(clientId: string, kind: ClientKind): void {
    const client = this.clients.get(clientId);
    if (client) client.kind = kind;
  }

  setView(clientId: string, view: ClientView): void {
    const client = this.clients.get(clientId);
    if (client) client.view = view;
  }

  setFit(clientId: string, on: boolean): void {
    const client = this.clients.get(clientId);
    if (client) client.fit = on;
  }

  touch(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) client.lastInteractionAt = Date.now();
  }

  addSubscription(clientId: string, paneId: PaneId): void {
    this.clients.get(clientId)?.subscriptions.add(paneId);
  }

  removeSubscription(clientId: string, paneId: PaneId): void {
    this.clients.get(clientId)?.subscriptions.delete(paneId);
  }

  subscriptions(clientId: string): PaneId[] {
    return [...(this.clients.get(clientId)?.subscriptions ?? [])];
  }
}
