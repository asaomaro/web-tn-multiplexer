import xtermHeadless from '@xterm/headless';
const { Terminal } = xtermHeadless;
const runtime = typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.versions.node}`;
const line = (i) => `\x1b[32m[${i}]\x1b[0m 日本語のログ行 ${i} ${'x'.repeat(80)}\r\n`;
const gc = () => { if (globalThis.gc) globalThis.gc(); else if (typeof Bun !== 'undefined') Bun.gc(true); };
gc(); const before = process.memoryUsage().rss;
const terms = [];
for (let p = 0; p < 16; p++) {
  const t = new Terminal({ cols: 120, rows: 40, scrollback: 10000, allowProposedApi: true });
  let s = ''; for (let i = 0; i < 10100; i++) s += line(i);
  await new Promise(r => t.write(s, r));
  terms.push(t);
}
gc(); const after = process.memoryUsage().rss;
console.log(JSON.stringify({ runtime, panes: 16, scrollback_lines: 10000, cols: 120, rss_delta_mb: Math.round((after-before)/1024/1024), per_pane_mb: +((after-before)/1024/1024/16).toFixed(1) }));
