import { DEFAULT_THEME } from "@wtm/protocol";
import type { ITheme } from "@xterm/xterm";

const ANSI_NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

/** `@wtm/protocol` の `DEFAULT_THEME`（サーバと共有する既定のテーマ）を xterm.js の `ITheme` に変換する。 */
export function toXtermTheme(): ITheme {
  const theme: ITheme = {
    foreground: DEFAULT_THEME.foreground,
    background: DEFAULT_THEME.background,
    cursor: DEFAULT_THEME.cursor,
  };
  ANSI_NAMES.forEach((name, i) => {
    (theme as Record<string, string>)[name] = DEFAULT_THEME.ansi[i]!;
  });
  return theme;
}
