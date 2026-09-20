import x from '@xterm/headless';
const t = new x.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
const got = [];
t.onData(d => got.push(JSON.stringify(d)));
for (const [name, seq] of [['OSC10?', '\x1b]10;?\x07'], ['OSC11?', '\x1b]11;?\x1b\\'], ['OSC12?', '\x1b]12;?\x07'], ['OSC4;1?', '\x1b]4;1;?\x07'], ['XTVERSION', '\x1b[>q'], ['DECRQSS', '\x1bP$qm\x1b\\'], ['DSR5', '\x1b[5n'], ['XTWINOPS18', '\x1b[18t'], ['kitty kbd query', '\x1b[?u']]) {
  got.length = 0;
  await new Promise(r => t.write(seq, r));
  await new Promise(r => setTimeout(r, 20));
  console.log(name.padEnd(16), got.join(' ') || '(no response)');
}
