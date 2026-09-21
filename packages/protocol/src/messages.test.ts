import { describe, expect, it } from "vitest";
import {
  METHOD_SCHEMAS,
  NewCwd,
  PaneSplitParams,
  TabCreateParams,
  WorkspaceCreateParams,
  WorkspaceRenameParams,
} from "./messages.js";

describe("messages", () => {
  it("validates pane.split params", () => {
    const parsed = PaneSplitParams.parse({ paneId: "p1", direction: "right" });
    expect(parsed).toEqual({ paneId: "p1", direction: "right" });
  });

  it("rejects an out-of-range ratio", () => {
    expect(() => PaneSplitParams.parse({ paneId: "p1", direction: "right", ratio: 1.5 })).toThrow();
  });

  it("registers a schema for every method the WebSocket table defines", () => {
    const methods = Object.keys(METHOD_SCHEMAS);
    expect(methods).toContain("client.hello");
    expect(methods).toContain("pane.subscribe");
    expect(methods).toContain("pane.unsubscribe");
    expect(methods).toContain("layout.set_split_ratio");
    expect(methods.length).toBe(Object.keys(METHOD_SCHEMAS).length);
    expect(new Set(methods).size).toBe(methods.length); // 重複登録が無い
  });
});

// 20260921-new-terminal-cwd：新しく開く場所の方針（herdr の `terminal.new_cwd`）。
describe("NewCwd", () => {
  it("4 つの方針の形を受け付ける", () => {
    expect(NewCwd.parse({ policy: "follow", sourcePaneId: "p1" })).toEqual({
      policy: "follow",
      sourcePaneId: "p1",
    });
    expect(NewCwd.parse({ policy: "follow" })).toEqual({ policy: "follow" }); // 分割では元の pane を付けない
    expect(NewCwd.parse({ policy: "home" })).toEqual({ policy: "home" });
    expect(NewCwd.parse({ policy: "current" })).toEqual({ policy: "current" });
    expect(NewCwd.parse({ policy: "path", path: "~/work" })).toEqual({
      policy: "path",
      path: "~/work",
    });
  });

  // 「指定した場所」を選んだまま何も入れていないブラウザから届く形。ここで弾くと作成が失敗する（サーバが使えない場所として扱う）。
  it("path の空文字・相対パスは通す（弾くのはサーバの検証）", () => {
    expect(NewCwd.parse({ policy: "path", path: "" })).toEqual({ policy: "path", path: "" });
    expect(NewCwd.parse({ policy: "path", path: "work/dir" })).toEqual({
      policy: "path",
      path: "work/dir",
    });
  });

  it("知らない方針・必要な値が無い形を弾く", () => {
    expect(() => NewCwd.parse({ policy: "elsewhere" })).toThrow();
    expect(() => NewCwd.parse({ policy: "path" })).toThrow(); // path が無い
    expect(() => NewCwd.parse({ policy: "follow", sourcePaneId: "" })).toThrow(); // 空の pane id
    expect(() => NewCwd.parse({})).toThrow();
  });

  it("3 つの作成の params が newCwd を受け付ける（無くてもよい）", () => {
    expect(WorkspaceCreateParams.parse({ newCwd: { policy: "home" } }).newCwd).toEqual({
      policy: "home",
    });
    expect(
      TabCreateParams.parse({ workspaceId: "w1", newCwd: { policy: "follow", sourcePaneId: "p1" } })
        .newCwd,
    ).toEqual({
      policy: "follow",
      sourcePaneId: "p1",
    });
    expect(
      PaneSplitParams.parse({ paneId: "p1", direction: "right", newCwd: { policy: "current" } })
        .newCwd,
    ).toEqual({ policy: "current" });
    expect(WorkspaceCreateParams.parse({}).newCwd).toBeUndefined();
  });

  // worktree を開く経路は cwd を明示する。両方来てもスキーマは通し、どちらを使うかはサーバが決める（cwd が勝つ。design D5）。
  it("workspace.create は cwd と newCwd を両方受け付ける", () => {
    expect(WorkspaceCreateParams.parse({ cwd: "/repo/wt", newCwd: { policy: "home" } })).toEqual({
      cwd: "/repo/wt",
      newCwd: { policy: "home" },
    });
  });
});

// 20260921-workspace-auto-label：null で自動の名前に戻す（pane の名前と同じ形）。
describe("WorkspaceRenameParams", () => {
  it("名前を付ける（文字列）と、自動の名前に戻す（null）を受け付ける", () => {
    expect(WorkspaceRenameParams.parse({ workspaceId: "w1", label: "api" }).label).toBe("api");
    expect(WorkspaceRenameParams.parse({ workspaceId: "w1", label: null }).label).toBeNull();
    // 空白だけはスキーマでは弾かず、サーバが trim して自動の名前として扱う（design D10 の前提）。
    expect(WorkspaceRenameParams.parse({ workspaceId: "w1", label: "  " }).label).toBe("  ");
  });

  // 空と null の 2 通りの「無い」を作らない（design D5）。空白だけはサーバが trim して自動として扱う（design D10）。
  it("空文字と、label の無い形は弾く", () => {
    expect(() => WorkspaceRenameParams.parse({ workspaceId: "w1", label: "" })).toThrow();
    expect(() => WorkspaceRenameParams.parse({ workspaceId: "w1" })).toThrow();
  });
});
