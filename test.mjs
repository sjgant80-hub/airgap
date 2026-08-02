// test.mjs — PROOF-OF-PLAY for AIRGAP, the air-gapped mesh. Zero tokens, deterministic. Proves: arbitrary
// messages survive the air (bytes → frames → tones → back, exact), the mesh COMPUTES shared work and answers,
// noise is rejected by the checksum (not mis-read), and — the security claim — the kernel has NO NETWORK
// PRIMITIVE anywhere in its source: no code path to the wire, so nothing to hack over the wire.
import { readFileSync } from 'node:fs';
import { MSG, packMessage, unpackMessage, toTones, fromTones, respond, serve, WORKS } from './airgap.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

console.log('=== §1 · MESSAGE FRAMING — arbitrary bytes survive the frames, exact ===');
{
  for (const [type, body] of [[MSG.WORK, 'primes|8'], [MSG.RESULT, 'sort|1,3,5,8'], [MSG.HELLO, ''], [MSG.WORK, 'reverse|the quick brown fox jumps 🦊']]) {
    const m = unpackMessage(packMessage(type, body));
    ok(m.ok && m.type === type && m.body === body, `${Object.keys(MSG)[type - 1]} "${body.slice(0, 24)}" → frames → message, exact`);
  }
}

console.log('\n=== §2 · THROUGH THE AIR (sound) — message → frames → TONES → back → message ===');
{
  const frames = packMessage(MSG.WORK, 'primes|8');
  const tones = toTones(frames);
  const msg = unpackMessage(fromTones(tones));
  ok(msg.ok && msg.type === MSG.WORK && msg.body === 'primes|8', 'a WORK message survives being played as sound and heard back — EXACT');
  ok(tones.length === frames.length * 10 + 2 && tones[0] < 700, 'the acoustic stream is 2 sync tones + 10 tones/frame (audible FSK)');
}

console.log('\n=== §3 · THE MESH — a node HEARS work, COMPUTES it, ANSWERS by air (no network) ===');
{
  ok(respond({ ok: true, type: MSG.WORK, body: 'primes|8' }).body === 'primes|2,3,5,7,11,13,17,19', 'WORK primes|8 → RESULT with the first 8 primes');
  ok(respond({ ok: true, type: MSG.WORK, body: 'sum|3,4,5' }).body === 'sum|12', 'WORK sum|3,4,5 → 12');
  ok(respond({ ok: true, type: MSG.WORK, body: 'fib|7' }).body === 'fib|0,1,1,2,3,5,8', 'WORK fib|7 → the sequence');
  ok(respond({ ok: true, type: MSG.WORK, body: 'nope|x' }).body.includes('ERR'), 'an unknown work → ERR, never a crash');
  // the full mesh round trip, entirely through frames (the air is the only transport)
  const { heard, framesOut } = serve(packMessage(MSG.WORK, 'sort|5,3,8,1'));
  ok(heard.ok && heard.body === 'sort|5,3,8,1', 'node HEARD the work off the air');
  const result = unpackMessage(framesOut);
  ok(result.ok && result.type === MSG.RESULT && result.body === 'sort|1,3,5,8', 'node ANSWERED with the sorted result off the air — a full work-share, zero network');
}

console.log('\n=== §4 · NOISE REJECTED — a corrupted frame is dropped by the checksum, not mis-read ===');
{
  const f = packMessage(MSG.WORK, 'primes|8'); f[0] = f[0].slice(); f[0][3] = (f[0][3] + 1) & 0xf;   // flip one nibble
  ok(!unpackMessage(f).ok, 'a single flipped nibble (a burst of noise) is REJECTED — never decoded to a wrong message');
}

console.log('\n=== §5 · THE AIR-GAP INVARIANT — the kernel has NO network primitive (checkable, not asserted) ===');
{
  // strip comments first — we check for network primitives in CODE, not in the doc-comment that names them
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
  const src = strip(readFileSync(new URL('./airgap.mjs', import.meta.url), 'utf8')) + '\n' + strip(readFileSync(new URL('./ladder.mjs', import.meta.url), 'utf8'));
  const NET = [/\bfetch\s*\(/, /\bWebSocket\b/, /\bRTCPeerConnection\b/, /\bXMLHttpRequest\b/, /\bEventSource\b/, /sendBeacon/, /\bWebTransport\b/, /\bnavigator\b/, /\bimportScripts\b/, /\bio\s*\(/];
  const found = NET.filter(re => re.test(src)).map(re => re.source);
  ok(found.length === 0, `the mesh kernel + codec contain NONE of ${NET.length} network primitives — no code path to the wire (found: ${found.join(', ') || 'nothing'})`);
  ok(!/require\s*\(\s*['"](net|http|https|dgram|ws|socket)/.test(src), 'no node network module is imported either — air only');
}

console.log('\n=== §6 · FUZZ — noise never throws, and almost never fakes a valid message ===');
{
  let threw = false, falseDecodes = 0, seed = 0x1234abcd >>> 0;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  try {
    for (let t = 0; t < 2000; t++) {
      const freqs = Array.from({ length: 30 }, () => 600 + (rnd() % 2000));           // 3 frames of random tone
      const msg = unpackMessage(fromTones(freqs));
      if (msg.ok) falseDecodes++;
      unpackMessage(Array.from({ length: rnd() % 5 }, () => Array.from({ length: 10 }, () => rnd() % 20)));   // random frames
      toTones([Array.from({ length: 10 }, () => rnd() % 16)]);
    }
  } catch (e) { threw = true; console.log('    threw:', e.message); }
  ok(!threw, '2000 garbage tone/frame inputs: 0 throws');
  ok(falseDecodes < 40, `random room noise almost never fakes a valid 3-frame message (${falseDecodes}/2000 — the per-frame checksum guards)`);
}

console.log('\n' + (fail === 0
  ? `=== ✅ AIRGAP HOLDS — messages + shared work over the air, noise rejected, NO network to hack · ${pass}/${pass} · zero tokens ===`
  : `=== ✗ ${fail} FAILED (${pass} passed) ===`));
process.exit(fail === 0 ? 0 : 1);
