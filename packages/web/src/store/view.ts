import type { SessionFocus, WorktreeEntry, WorktreeListResult } from "@wtm/protocol";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Mode } from "../keys/actions.js";
import type { ConnectionState } from "../net/ports.js";
import type { MenuTarget } from "../term/MouseBridge.js";

const STORAGE_KEY = "wtm.view.v1";

export interface StoredView {
  workspaceId: string;
  tabId: string;
}

function loadStoredView(): StoredView | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "workspaceId" in parsed && "tabId" in parsed) return parsed as StoredView;
    return null;
  } catch {
    return null;
  }
}

function saveStoredView(v: StoredView): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // 保存できなくても致命的ではない（次回は再度 focus から決める）。
  }
}

/** agents の並び順（20260920-sidebar-tabbar-controls）。`grouped` は並べ替えない（既定）。 */
export type AgentSort = "grouped" | "priority";

/**
 * 表示位置（`STORAGE_KEY`）と違い、**タブの寿命を越えて残す好み**なので `localStorage` に置く。
 * 同じ流儀の先例：`store/seen.ts`（`wtm.seen.v1`）・`components/Toast.vue`（`wtm.hint.prefixHelp.v1`）。
 */
const PREFS_KEY = "wtm.prefs.v1";

/**
 * `wtm.prefs.v1` の読み書きは**この 2 つに集約する**（20260920-agent-notifications の AC6）。
 * 以前は `JSON.stringify({ agentSort: v })` で**オブジェクトごと置き換えて**いたので、
 * 項目を足しても**並び順を切り替えた瞬間に消えた**。複数のストアが同じキーを別々に
 * read-modify-write しないよう、所有者をここ 1 つにする。
 */
export function readPrefs(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {}; // プライベートウィンドウ等で読めなくても動く（保存が効かないだけ）
  }
}

/** 既存の値に**併合して**書く。**読みも書きも同じ try/catch の内側**に置く（読めない環境で throw させない）。 */
export function writePrefs(patch: Record<string, unknown>): void {
  try {
    const current = readPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // 保存できなくても致命的ではない（この画面の間だけ効く）。
  }
}

function loadAgentSort(): AgentSort {
  const v = readPrefs()["agentSort"];
  return v === "priority" || v === "grouped" ? v : "grouped"; // 壊れた値は既定へ落とす
}

function saveAgentSort(v: AgentSort): void {
  writePrefs({ agentSort: v });
}

/**
 * サイドバーの幅（px）。**設定の項目ではなく、ドラッグした結果を覚えるだけ**（20260921-herdr-settings-gaps の D1。
 * herdr も端末ごとの preferences に保存し、設定画面の項目にはしていない）。
 */
export const SIDEBAR_WIDTH = { default: 240, min: 160, max: 360 } as const;

/**
 * 保存された幅を読む。**範囲の外は丸めずに既定へ落とす**——ドラッグは範囲に収めるので、範囲の外の値は
 * 保存しえない＝壊れた値（20260921-herdr-settings-gaps の AC3）。
 */
export function loadSidebarWidth(raw: unknown): number {
  const ok = typeof raw === "number" && Number.isFinite(raw) && raw >= SIDEBAR_WIDTH.min && raw <= SIDEBAR_WIDTH.max;
  return ok ? raw : SIDEBAR_WIDTH.default;
}

/** 保存された折りたたみを読む。`true` のときだけ畳む（壊れた値は展開＝既定。20260921-herdr-settings-gaps の AC3）。 */
export function loadSidebarCollapsed(raw: unknown): boolean {
  return raw === true;
}

let nextToastId = 1;

/** トーストの行動ボタン（`sticky` のときだけ置く。20260920-agent-notifications）。 */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  /**
   * 既定（`undefined`）は今までどおり 4 秒で自動的に消える。
   * **`"sticky"` は消えない**——席を外している間に出た知らせが消えていては意味が無い
   * （20260920-agent-notifications の requirements）。消すのは利用者の操作か、
   * `prefix+o` で対象へ移ったとき。
   */
  kind?: "sticky";
  /** `sticky` に添えるボタン。トースト本体のクリックは今までどおり「消す」なので、ボタン側で `@click.stop` する。 */
  actions?: ToastAction[];
  /** `true` なら 1 行に畳まない（案内だけの例外。狭い画面で本文が読めなくなるため）。 */
  wrap?: boolean;
}

export interface ToastOptions {
  kind?: "sticky";
  actions?: ToastAction[];
  wrap?: boolean;
}

/**
 * 開いているダイアログの種類ごとの文脈（T17・T18・T23〜T25 が使う）。`openDialog` は
 * `KeyRouter`/`KeyInputController` へ渡すモード名（"dialog"）との対応用の軽い印。
 */
export type DialogContext =
  | { kind: "newTab"; workspaceId: string }
  | { kind: "renamePane"; paneId: string; currentLabel: string }
  | { kind: "renameTab"; tabId: string; currentLabel: string }
  | { kind: "renameWorkspace"; workspaceId: string; currentLabel: string }
  | { kind: "confirmClose"; targets: { type: "pane" | "tab" | "workspace"; id: string }[] }
  | { kind: "help" }
  | { kind: "goto" }
  // worktree（20260920-git-worktree-actions）。**サーバへ聞いてから開く**ので、開く時点で中身が揃っている。
  | { kind: "worktreeCreate"; workspaceId: string; info: WorktreeListResult }
  | { kind: "worktreeOpen"; workspaceId: string; entries: WorktreeEntry[] }
  // 設定（通知・表示・端末。20260921-herdr-settings-gaps）。値はそれぞれのストアが持つので文脈は空。
  | { kind: "settings" };

/**
 * このクライアントの表示・モード・接続状態（architecture.md「store/view」）。
 * workspace/tab/pane の**構造**は `store/session` の担当——ここは「このブラウザが今どこを見ているか」だけ。
 */
export const useViewStore = defineStore("view", () => {
  const workspaceId = ref<string | null>(null);
  const tabId = ref<string | null>(null);
  const focusedPaneId = ref<string | null>(null);

  const mode = ref<Mode>("terminal");
  const openDialog = ref<string | null>(null);
  const dialogContext = ref<DialogContext | null>(null);
  /** ダイアログを開く前にフォーカスしていた pane（AC-I4「閉じたら開く前の pane に戻す」）。 */
  const preDialogFocusPaneId = ref<string | null>(null);
  /** navigate モード中に選択中の workspace（`↑/↓` で動かす。Enter で確定）。 */
  const navigateSelection = ref<string | null>(null);
  const contextMenu = ref<{ target: MenuTarget; at: { x: number; y: number } } | null>(null);
  const connectionState = ref<ConnectionState>("connecting");
  const authRequired = ref(false);
  /**
   * `onAuthRequired` が呼ばれた回数（D105）。`authRequired` が既に true のまま呼ばれても（ログインの直後の `/api/session`
   * が 401・`/ws` が 4401 等）変わるので、ログイン画面が「ログインできた、接続中…」の待ちから戻る合図にする。
   * `authRequired` の意味（`open` になるまで下ろさない）は変えない。
   */
  const authRequiredCount = ref(0);
  /**
   * 繋ぎ直しで、`/api/session` は通るのに WebSocket だけが開く前に閉じる試みが続いている（D107。`StorePort.onOriginRejectSuspected`）。
   * `ReconnectOverlay` が「再接続中…」に、サーバがこのページの Origin を拒否しているかもしれないという手がかりを添える。
   */
  const originRejectSuspected = ref(false);
  const initialPrefs = readPrefs();
  /**
   * 畳んだかどうか。**切り替えるたびに保存する**（20260921-herdr-settings-gaps の AC2。`prefix+b` と畳むボタンは
   * 同じ `toggleSidebar` を通る）。
   */
  const sidebarCollapsed = ref(loadSidebarCollapsed(initialPrefs["sidebarCollapsed"]));
  /**
   * サイドバーの幅。**ドラッグ中は `setSidebarWidth` で反映するだけ**で、保存はドラッグを終えたとき
   * （`commitSidebarWidth`）に 1 回——`pointermove` ごとに `localStorage` へ書くと、毎フレーム同期の I/O が走る。
   */
  const sidebarWidth = ref(loadSidebarWidth(initialPrefs["sidebarWidth"]));
  const agentSort = ref(loadAgentSort());
  const toasts = ref<Toast[]>([]);

  /**
   * `client.hello` 直後の表示（design「フォーカスと表示」）。前回の tab がまだあればそれ、無ければサーバの
   * focus。`findTabFocusedPaneId` は「その tab がまだ存在するか」と「その tab の（サーバ全体で最後に
   * フォーカスされた）pane」を同時に返す——前回の tab を復元したときも、その tab の pane へ
   * フォーカスを合わせる必要があるため（AC-I3。ページの再読み込み（F5）のたびに一度クリックし直さないと
   * キーボード操作を再開できない、という不具合を review で発見。修正）。
   */
  function restoreView(findTabFocusedPaneId: (workspaceId: string, tabId: string) => string | null, serverFocus: SessionFocus | null): void {
    const stored = loadStoredView();
    if (stored) {
      const paneId = findTabFocusedPaneId(stored.workspaceId, stored.tabId);
      if (paneId !== null) {
        setView(stored.workspaceId, stored.tabId);
        focusedPaneId.value = paneId;
        return;
      }
    }
    if (serverFocus) {
      setView(serverFocus.workspaceId, serverFocus.tabId);
      focusedPaneId.value = serverFocus.paneId;
    }
  }

  function setView(newWorkspaceId: string, newTabId: string): void {
    workspaceId.value = newWorkspaceId;
    tabId.value = newTabId;
    saveStoredView({ workspaceId: newWorkspaceId, tabId: newTabId });
  }

  function focusPane(paneId: string | null): void {
    focusedPaneId.value = paneId;
  }

  function onModeChange(m: Mode): void {
    mode.value = m;
  }

  function setOpenDialog(name: string | null): void {
    openDialog.value = name;
  }

  /** ダイアログを開く（現在の focus を覚えておく。T18/T23〜T25 が使う）。 */
  function openDialogWithContext(ctx: DialogContext): void {
    preDialogFocusPaneId.value = focusedPaneId.value;
    dialogContext.value = ctx;
    openDialog.value = ctx.kind;
  }

  /**
   * ダイアログを開いている間の焦点の移し直し（D97）。開いている間に「開く前の pane」が閉じられたら、閉じたときに
   * 戻す先だけを差し替える——`focusedPaneId` を直接変えると、その pane の `TerminalPane` が `term.focus()` して
   * ダイアログの入力欄からフォーカスを奪ってしまう。
   */
  function retargetPreDialogFocus(paneId: string | null): void {
    preDialogFocusPaneId.value = paneId;
  }

  /** ダイアログを閉じる（確定・取り消しのどちらでも呼ぶ）。開く前の pane へフォーカスを戻す（AC-I4）。 */
  function closeDialog(): void {
    dialogContext.value = null;
    openDialog.value = null;
    if (preDialogFocusPaneId.value) focusedPaneId.value = preDialogFocusPaneId.value;
    preDialogFocusPaneId.value = null;
  }

  function setNavigateSelection(workspaceId2: string | null): void {
    navigateSelection.value = workspaceId2;
  }

  function openContextMenu(target: MenuTarget, at: { x: number; y: number }): void {
    contextMenu.value = { target, at };
  }

  function closeContextMenu(): void {
    contextMenu.value = null;
  }

  function onConnectionState(s: ConnectionState): void {
    connectionState.value = s;
    // `rejected`（`/api/session` が 403 で `/ws` も開く前に閉じた）も下ろす：サーバは Cookie を先に確かめ、無効なら Host を問わず
    // 401 を返すので、403 は Cookie が有効な証拠（サーバの D106）。ログイン画面の「接続中…」のまま止めず、本体の重ね表示で理由を示す（D107）。
    if (s === "open" || s === "rejected") authRequired.value = false;
  }

  function setOriginRejectSuspected(suspected: boolean): void {
    originRejectSuspected.value = suspected;
  }

  function onAuthRequired(): void {
    authRequired.value = true;
    authRequiredCount.value++;
  }

  /** agents の並び順を 2 値で行き来する（herdr と同じく順序名そのものがボタン）。切り替えるたびに保存する。 */
  function toggleAgentSort(): void {
    agentSort.value = agentSort.value === "grouped" ? "priority" : "grouped";
    saveAgentSort(agentSort.value);
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    writePrefs({ sidebarCollapsed: sidebarCollapsed.value });
  }

  /** 幅を範囲に収めて反映する。**保存はしない**（ドラッグの途中。保存は `commitSidebarWidth`）。 */
  function setSidebarWidth(px: number): void {
    sidebarWidth.value = Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, px));
  }

  /** いまの幅を保存する（ドラッグを終えたとき・既定に戻したとき。20260921-herdr-settings-gaps の AC1）。 */
  function commitSidebarWidth(): void {
    writePrefs({ sidebarWidth: sidebarWidth.value });
  }

  /** `opts` を省けば今までどおり（4 秒で消える 1 行）。`kind: "sticky"` は消えない（20260920-agent-notifications）。 */
  function toast(message: string, opts?: ToastOptions): number {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, message, ...opts }];
    return id;
  }

  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  const isPrefixWaiting = computed(() => mode.value === "prefix");

  return {
    workspaceId,
    tabId,
    focusedPaneId,
    preDialogFocusPaneId,
    mode,
    openDialog,
    dialogContext,
    navigateSelection,
    contextMenu,
    connectionState,
    authRequired,
    authRequiredCount,
    originRejectSuspected,
    sidebarCollapsed,
    sidebarWidth,
    agentSort,
    toggleAgentSort,
    toasts,
    isPrefixWaiting,
    restoreView,
    setView,
    focusPane,
    onModeChange,
    setOpenDialog,
    openDialogWithContext,
    closeDialog,
    retargetPreDialogFocus,
    setNavigateSelection,
    openContextMenu,
    closeContextMenu,
    onConnectionState,
    onAuthRequired,
    setOriginRejectSuspected,
    toggleSidebar,
    setSidebarWidth,
    commitSidebarWidth,
    toast,
    dismissToast,
  };
});
