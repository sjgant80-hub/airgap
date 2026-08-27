// harden.test.mjs — the 2026-08-27 re-gate for BOTH kernels: 22 survivors mapped, each pinned or
// argued. The prettiest kills are the checksum-invisible corruptions: a fractional symbol and the
// ±16 aliases xor to the same nibble, so only the GUARD can catch them — and now it must.
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));

// the original suite ends in process.exit — run it as its OWN process so its verdict still kills
test('the original bare-assert suite holds', () => {
  execFileSync(process.execPath, [join(here, 'test.mjs')], { stdio: 'pipe' });
});
import assert from 'node:assert/strict';
import { KAPPA, sig, encode, decode, FRAME, sound, radio, light, roundtrip, LIGHT_PREAMBLE } from './ladder.mjs';
import { MSG, packMessage, unpackMessage, toneToNibble, fromTones, respond, ACOUSTIC } from './airgap.mjs';

test('KAPPA — 1/φ exactly, never (√5+1)/2', () => {
  assert.ok(Math.abs(KAPPA - 0.6180339887498949) < 1e-15);
});

test('SIG — the fold-signature is pinned; one extra charCode would poison it', () => {
  assert.equal(sig('konomi'), sig('KONOMI'), 'case-folded');
  assert.equal(typeof sig('konomi'), 'number');
  assert.equal(sig('konomi'), 3021561382);
});

test('DECODE — checksum-invisible corruptions die at the guard: fractional, −16 alias, +16 alias', () => {
  const good = encode(7);
  assert.equal(decode(good).ok, true);
  const frac = good.slice(); frac[2] = good[2] + 0.5;                       // xor truncates floats — the checksum cannot see this
  assert.equal(decode(frac).ok, false, 'a fractional symbol is refused by the guard, not the checksum');
  const neg = good.slice(); neg[3] = good[3] - 16; // (x−16)&0xf === x&0xf — checksum-identical
  assert.equal(decode(neg).ok, false, 'a −16 alias is refused');
  const big = good.slice(); big[4] = good[4] + 16; // (x+16)&0xf === x&0xf — checksum-identical
  assert.equal(decode(big).ok, false, 'a +16 alias is refused');
  assert.equal(decode(null).ok, false, 'null refuses, never throws');
  assert.equal(decode('x').ok, false);
});

test('LIGHT — the exact-length frame decodes; a complemented preamble is NOISE, not a frame', () => {
  for (const n of [0, 7, 0xdeadbeef]) {
    const r = roundtrip(n, 'light');
    assert.equal(r.ok, true, 'light round-trip exact at ' + n);
    assert.equal(r.carried.length, LIGHT_PREAMBLE.length + FRAME * 4, 'voiced length is exactly preamble+40 — the scan bound is inclusive');
  }
  const anti = LIGHT_PREAMBLE.map((b) => 1 - b).concat(Array(FRAME * 4).fill(0));
  assert.deepEqual(light.hear(anti), [], 'a window that mismatches the preamble everywhere is not a frame');
});

test('ROUNDTRIP — all three rungs exact; ok is the AND of decode and identity', () => {
  for (const rung of ['sound', 'radio', 'light']) {
    const r = roundtrip(12345, rung);
    assert.equal(r.ok, true, rung + ' carries the number home');
    assert.equal(r.n, 12345);
  }
});

test('AIRGAP PACK — frame count is exact: a phantom zero-word never rides', () => {
  const frames = packMessage(MSG.HELLO, 'abc');   // 4 bytes → length word + 1 data word
  assert.equal(frames.length, 2);
  const round = unpackMessage(frames);
  assert.equal(round.ok, true);
  assert.equal(round.body, 'abc');
  assert.equal(round.type, MSG.HELLO);
});

test('AIRGAP UNPACK + RESPOND — guards refuse, never throw', () => {
  assert.equal(unpackMessage([]).ok, false);
  assert.match(unpackMessage([]).why, /no frames/);
  assert.equal(unpackMessage('x').ok, false, 'a non-array refuses instead of throwing');
  assert.equal(respond(null), null, 'null message → null reply, no throw');
  assert.equal(respond({ ok: false }), null);
});

test('TONES — the half-step fence keeps the boundary tone; frames need exactly FRAME nibbles', () => {
  const edge = ACOUSTIC.base - ACOUSTIC.step / 2;  // exactly ON the fence — kept, not dropped
  const frames = fromTones(Array(FRAME).fill(edge));
  assert.equal(frames.length, 1, 'FRAME boundary tones make exactly one frame');
  assert.equal(toneToNibble(ACOUSTIC.base), 0);
  assert.equal(toneToNibble(-1e9), 0, 'clamped, never throws');
  assert.equal(toneToNibble(1e9), 15);
});
