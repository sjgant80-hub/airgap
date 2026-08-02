// airgap.mjs — AIR-GAPPED MESH COMPUTE. Nodes share work over SOUND / LIGHT / RADIO with ZERO network stack.
//
// The one-ladder codec (proven round-trip) carries a 32-bit word per frame. airgap adds MESSAGE framing on
// top (arbitrary bytes → frames → bytes) and a real WORK-SHARING protocol: a node broadcasts a task, another
// hears it BY AIR, computes it, and broadcasts the result — no internet, ever, by design.
//
// THE SECURITY INVARIANT (checkable, not asserted): this kernel — and everything it imports — contains NO
// network primitive (fetch / WebSocket / RTCPeerConnection / XMLHttpRequest / EventSource / sendBeacon).
// There is no code path to the wire, so there is nothing to hack over the wire. The channel is air only:
// microphone/speaker (sound), screen/camera (light). Honest scope: this removes the NETWORK surface; it does
// NOT stop acoustic eavesdropping/injection in the room or a compromised host. Unhackable over the wire —
// because there is no wire. Pure, zero-dep, Node + browser.
import { encode, decode, FRAME } from './ladder.mjs';

export const MSG = { HELLO: 1, WORK: 2, RESULT: 3 };

// ── bytes ⇄ 32-bit words (length-prefixed, big-endian) ⇄ ladder frames ──
function bytesToWords(bytes) { const w = [bytes.length >>> 0]; for (let i = 0; i < bytes.length; i += 4) w.push(((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0); return w; }
function wordsToBytes(words) { const len = (words[0] >>> 0), out = []; for (let i = 1; i < words.length; i++) { const x = words[i] >>> 0; out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); } return out.slice(0, len); }

// a MESSAGE { type, body } → a stream of ladder frames (each a 10-nibble, checksummed word)
export function packMessage(type, body = '') {
  const bytes = [type & 0xff, ...Array.from(new TextEncoder().encode(String(body ?? '')))];
  return bytesToWords(bytes).map(encode);
}
export function unpackMessage(frames) {
  if (!Array.isArray(frames) || !frames.length) return { ok: false, why: 'no frames' };
  const words = frames.map(decode);
  if (words.some(w => !w.ok)) return { ok: false, why: 'a frame failed its checksum (noise / partial)' };
  const bytes = wordsToBytes(words.map(w => w.n));
  if (!bytes.length) return { ok: false, why: 'empty' };
  return { ok: true, type: bytes[0], body: new TextDecoder().decode(new Uint8Array(bytes.slice(1))) };
}

// ── THE ACOUSTIC CARRIER — a nibble → an audible FSK tone (16 well-separated bins). The air is sound. ──
export const ACOUSTIC = { base: 700, step: 120, preamble: 620 };     // 700..2500 Hz data · 620 Hz sync
export function toTones(frames) {
  const flat = frames.flat();
  return [ACOUSTIC.preamble, ACOUSTIC.preamble, ...flat.map(nib => ACOUSTIC.base + (nib & 0xf) * ACOUSTIC.step)];
}
// nearest-bin decode of a heard tone → a nibble (clamped). NEVER throws on noise.
export function toneToNibble(hz) { const v = Math.round((hz - ACOUSTIC.base) / ACOUSTIC.step); return v < 0 ? 0 : v > 15 ? 15 : v; }
export function fromTones(freqs) {
  const arr = Array.isArray(freqs) ? freqs : [];
  const data = arr.filter(f => f >= ACOUSTIC.base - ACOUSTIC.step / 2);          // drop the preamble/sync tones
  const nibs = data.map(toneToNibble), frames = [];
  for (let i = 0; i + FRAME <= nibs.length; i += FRAME) frames.push(nibs.slice(i, i + FRAME));
  return frames;
}

// ── THE MESH — a node hears WORK, computes it, answers with RESULT. All by air. ──
// pure, deterministic work functions (a real compute the mesh shares — no I/O, no network)
export const WORKS = {
  sum: a => String(a.split(',').map(Number).reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0)),
  sort: a => a.split(',').map(Number).filter(Number.isFinite).sort((x, y) => x - y).join(','),
  reverse: a => [...String(a)].reverse().join(''),
  primes: a => { const n = Math.max(0, Math.min(64, Math.floor(+a) || 0)), out = []; for (let i = 2; out.length < n; i++) { let p = true; for (let j = 2; j * j <= i; j++) if (i % j === 0) { p = false; break; } if (p) out.push(i); } return out.join(','); },
  fib: a => { const n = Math.max(0, Math.min(40, Math.floor(+a) || 0)), out = []; let x = 0, y = 1; for (let i = 0; i < n; i++) { out.push(x);[x, y] = [y, x + y]; } return out.join(','); },
};

// given a decoded message, produce the reply (or null if nothing to do). This is the whole mesh brain.
export function respond(msg) {
  if (!msg || !msg.ok) return null;
  if (msg.type === MSG.HELLO) return { type: MSG.HELLO, body: 'here' };
  if (msg.type !== MSG.WORK) return null;
  const [name, ...rest] = String(msg.body).split('|'), arg = rest.join('|');
  const fn = WORKS[name];
  if (!fn) return { type: MSG.RESULT, body: name + '|ERR unknown-work' };
  let out; try { out = String(fn(arg)); } catch { out = 'ERR failed'; }
  return { type: MSG.RESULT, body: name + '|' + out };
}

// convenience: the full round trip a mesh node does by air (frames in → frames out), for testing + the loopback demo
export function serve(framesIn) {
  const msg = unpackMessage(framesIn);
  const reply = respond(msg);
  return { heard: msg, reply, framesOut: reply ? packMessage(reply.type, reply.body) : null };
}

export default { MSG, packMessage, unpackMessage, toTones, fromTones, toneToNibble, WORKS, respond, serve, ACOUSTIC };
