/** 設定・引数の誤り（`main.ts` が終了コード 2 で終わる）。`config.ts` から分けたのは、`config.ts` が使う部品（`persist/namedSession.ts`）からも循環せずに使うため。 */
export class ConfigError extends Error {
  /** `main.ts` が終了コード 2 で使う理由の要約。 */
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "ConfigError";
    this.hint = hint;
  }
}
