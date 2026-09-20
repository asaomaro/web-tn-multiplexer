import x from '@xterm/headless';
const t = new x.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
const got = [];
t.onData(d => got.push(JSON.stringify(d)));
await new Promise(r => t.write('hello\x1b[c\x1b[>c\x1b[6n\x1b[?1049h\x1b[?2004h\x1b[?25$p', r));
await new Promise(r => setTimeout(r, 50));
console.log('onData responses:', got.join(' '));
console.log('has registerCsiHandler:', typeof t.parser?.registerCsiHandler, 'registerOscHandler:', typeof t.parser?.registerOscHandler);
console.log('modes:', JSON.stringify(t.modes));
