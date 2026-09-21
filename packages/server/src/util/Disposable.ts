/** サーバ内で共通して使う「後始末できるもの」の型（`IDisposable` 系のライブラリとも構造的に互換）。 */
export interface Disposable {
  dispose(): void;
}
