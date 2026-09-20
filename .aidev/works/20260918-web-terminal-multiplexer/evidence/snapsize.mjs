import x from '@xterm/headless';
import s from '@xterm/addon-serialize';
import zlib from 'node:zlib';
const mk = (i) => `\x1b[32m[${i}]\x1b[0m compiling module_${i % 97}.ts \x1b[2m(${(i*7)%1000}ms)\x1b[0m\r\n\x1b[38;2;${i%255};128;200m日本語のログ行 ${i} — 全角文字を含む出力\x1b[0m\r\n`;
for (const lines of [0, 1000, 5000, 10000]) {
  const t = new x.Terminal({ cols: 120, rows: 40, scrollback: 10000, allowProposedApi: true });
  const ser = new s.SerializeAddon(); t.loadAddon(ser);
  let d=''; for (let i=0;i<6000;i++) d+=mk(i);
  await new Promise(r=>t.write(d,r));
  const t0=performance.now(); const out = ser.serialize({ scrollback: lines }); const t1=performance.now();
  const raw = Buffer.byteLength(out,'utf8');
  const def = zlib.deflateRawSync(Buffer.from(out,'utf8'), { level: 1 }).length;
  console.log(JSON.stringify({ scrollback_lines: lines, serialize_ms: Math.round(t1-t0), raw_kb: Math.round(raw/1024), deflate_kb: Math.round(def/1024), ratio: +(raw/def).toFixed(1) }));
}
