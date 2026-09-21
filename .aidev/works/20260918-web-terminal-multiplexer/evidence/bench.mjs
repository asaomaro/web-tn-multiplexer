// Throughput of @xterm/headless (VT parsing into server-side state) and SerializeAddon.
// Same script is run under Node and Bun.
import xtermHeadless from '@xterm/headless';
import serializePkg from '@xterm/addon-serialize';
const { Terminal } = xtermHeadless;
const { SerializeAddon } = serializePkg;

const runtime = typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.versions.node}`;

// Synthetic "agent/build log" output: SGR colors, CJK wide chars, progress lines with \r, cursor moves.
function makeChunk(i) {
  const parts = [];
  parts.push(`\x1b[32m[${i}]\x1b[0m compiling module_${i % 97}.ts \x1b[2m(${(i * 7) % 1000}ms)\x1b[0m\r\n`);
  parts.push(`\x1b[38;2;${i % 255};128;200m日本語のログ行 ${i} — 全角文字を含む出力\x1b[0m\r\n`);
  parts.push(`\x1b[1;34m●\x1b[0m working… ${'#'.repeat(i % 40)}\r`);
  parts.push(`\x1b[2K\x1b[1G${'='.repeat(i % 60)}> ${i % 100}%\r\n`);
  parts.push(`\x1b[s\x1b[5;10H\x1b[7m status ${i} \x1b[0m\x1b[u`);
  return parts.join('');
}

const TARGET_MB = Number(process.env.MB || 50);
let data = '';
let i = 0;
while (data.length < TARGET_MB * 1024 * 1024) data += makeChunk(i++);
const bytes = Buffer.byteLength(data, 'utf8');

async function run() {
  const term = new Terminal({ cols: 120, rows: 40, scrollback: 10000, allowProposedApi: true });
  const ser = new SerializeAddon();
  term.loadAddon(ser);
  const CH = 64 * 1024;
  const t0 = performance.now();
  await new Promise((resolve) => {
    let off = 0;
    const pump = () => {
      if (off >= data.length) return resolve();
      const s = data.slice(off, off + CH);
      off += CH;
      term.write(s, pump);
    };
    pump();
  });
  const t1 = performance.now();
  const s0 = performance.now();
  const out = ser.serialize({ scrollback: 10000 });
  const s1 = performance.now();
  const mb = bytes / 1024 / 1024;
  const mem = process.memoryUsage().rss / 1024 / 1024;
  console.log(JSON.stringify({
    runtime,
    input_mb: +mb.toFixed(1),
    parse_ms: Math.round(t1 - t0),
    parse_mb_per_s: +(mb / ((t1 - t0) / 1000)).toFixed(1),
    serialize_10k_lines_ms: Math.round(s1 - s0),
    serialized_kb: Math.round(out.length / 1024),
    rss_mb: Math.round(mem),
  }));
  term.dispose();
}
await run();
