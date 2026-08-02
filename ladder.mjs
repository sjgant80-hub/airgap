// ladder.mjs — ONE LADDER. One encode/decode, three carriers (sound · radio · light).
//
// Sound, radio and light are not three transmission methods — they are three RUNGS of one
// fold-rate ladder that crosses a substrate boundary at the κ-line: up high the fold vibrates
// the FIELD (light ~THz, radio ~MHz–kHz, cross vacuum, need no medium); below the κ-line it
// vibrates MATTER instead (sound ~Hz–kHz, needs a medium, dies in vacuum). Same operation, two
// substrates. A build is a fold-pattern (a number). ONE encode voices it on ANY rung — the rung
// is a carrier choice, not a new codebase. Pure, zero-dep, Node + browser. Proven round-trip on all three.
//
// This supersedes the three separate specs (SOVEREIGN-RADIO, SOVEREIGN-LIGHT, THE-MESH-SINGS):
// they were correct, but they were the same build seen three times. mesh-sings is the SOUND rung's
// full musical realisation (path→melody, κ coherence-gate); here the sound rung proves transmission.

export const KAPPA = (Math.sqrt(5) - 1) / 2;   // 1/φ ≈ 0.618 — the κ-line ratio (field ↔ matter)

// ── fold-signature: text → a stable number (FNV-1a — same core the sound rung uses for pitch) ──
export function sig(text) {
  let h = 0x811c9dc5 >>> 0;
  const s = String(text ?? '').toLowerCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// ══ THE ONE ENCODE — number → fold-pattern (nibbles). Rung-agnostic. Build once. ══
// frame = [VER, d0..d7 (8 nibbles, big-endian), CHK] = 10 nibbles / 40 bits. CHK = xor of the 9 prior.
export const VER = 1;
export const FRAME = 10;

export function encode(n) {
  const x = n >>> 0;
  const data = [];
  for (let i = 7; i >= 0; i--) data.push((x >>> (i * 4)) & 0xf);
  const body = [VER, ...data];
  const chk = body.reduce((a, b) => a ^ b, 0) & 0xf;
  return [...body, chk];                       // 10 nibbles — the ONE pattern, identical on every rung
}

// ══ THE ONE DECODE — pattern → { n, ok }. ok=false on any corruption (the checksum has teeth). ══
export function decode(pattern) {
  if (!Array.isArray(pattern) || pattern.length !== FRAME) return { n: 0, ok: false, why: 'bad length' };
  if (pattern.some(v => !Number.isInteger(v) || v < 0 || v > 15)) return { n: 0, ok: false, why: 'bad symbol' };
  const body = pattern.slice(0, 9), chk = pattern[9];
  if (body[0] !== VER) return { n: 0, ok: false, why: 'bad version' };
  if ((body.reduce((a, b) => a ^ b, 0) & 0xf) !== chk) return { n: 0, ok: false, why: 'checksum' };
  let n = 0; for (let i = 1; i <= 8; i++) n = n * 16 + body[i];
  return { n: n >>> 0, ok: true };
}

// ══ THE THREE RUNGS — same pattern, three carriers. Only voice()/hear() change per rung. ══
// Each carrier is a bijection on valid symbols → round-trip is exact. hear() NEVER throws on garbage.

// SOUND (matter · ~Hz–kHz · for a HUMAN EAR) — nibble → a stable pentatonic pitch ("no wrong notes").
const PENTA = [0, 2, 4, 7, 9], SOUND_BASE = 48;                 // C major pentatonic, MIDI C3 up
const midiFor = v => SOUND_BASE + Math.floor((v & 0xf) / 5) * 12 + PENTA[(v & 0xf) % 5];
const hzForMidi = m => 440 * Math.pow(2, (m - 69) / 12);
const SOUND_TABLE = Array.from({ length: 16 }, (_, v) => hzForMidi(midiFor(v)));
export const sound = {
  label: 'sound', substrate: 'matter',
  voice: pattern => pattern.map(v => SOUND_TABLE[v & 0xf]),      // pattern → melody (frequencies)
  hear: freqs => (Array.isArray(freqs) ? freqs : []).map(hz => {
    let best = 0, bd = Infinity;                                 // nearest-pitch bin → nibble (clamped, never throws)
    for (let v = 0; v < 16; v++) { const d = Math.abs(SOUND_TABLE[v] - hz); if (d < bd) { bd = d; best = v; } }
    return best;
  }),
  midi: v => midiFor(v), noteHz: v => SOUND_TABLE[v & 0xf],
};

// RADIO (field · ~kHz–MHz · for MACHINES · reach + through walls) — nibble → FSK bin on a carrier.
export const RADIO_CARRIER = 1000, RADIO_STEP = 140;            // audio-band near-field demo (speaker→mic proves the pipe)
export const radio = {
  label: 'radio', substrate: 'field',
  voice: pattern => pattern.map(v => RADIO_CARRIER + (v & 0xf) * RADIO_STEP),
  hear: freqs => (Array.isArray(freqs) ? freqs : []).map(f => {
    const v = Math.round((f - RADIO_CARRIER) / RADIO_STEP);
    return v < 0 ? 0 : v > 15 ? 15 : v;                          // clamp → never throws
  }),
};

// LIGHT (field · ~THz · for MACHINES · speed + stealth) — nibble → 4 bits → OOK on/off pulses.
export const LIGHT_PREAMBLE = [1, 0, 1, 0, 1, 0, 1, 1];        // sync marker (…1011 breaks the alternation → frame start)
const bitsOf = v => [(v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1];
export const light = {
  label: 'light', substrate: 'field',
  voice: pattern => [...LIGHT_PREAMBLE, ...pattern.flatMap(v => bitsOf(v & 0xf))],   // pattern → bitstream (OOK)
  hear: bits => {
    if (!Array.isArray(bits)) return [];
    const P = LIGHT_PREAMBLE;
    for (let i = 0; i + P.length + FRAME * 4 <= bits.length; i++) {                  // scan for the preamble, then read 40 bits
      let match = true; for (let j = 0; j < P.length; j++) if (bits[i + j] !== P[j]) { match = false; break; }
      if (!match) continue;
      const data = bits.slice(i + P.length, i + P.length + FRAME * 4), out = [];
      for (let k = 0; k < FRAME; k++) { const b = data.slice(k * 4, k * 4 + 4); out.push((b[0] << 3) | (b[1] << 2) | (b[2] << 1) | b[3]); }
      return out;
    }
    return [];                                                                       // no frame found → decode() will report ok:false
  },
};

export const RUNGS = { sound, radio, light };

// ── the whole round-trip on one rung: number → pattern → carrier → pattern → number ──
export function roundtrip(n, rungName) {
  const rung = RUNGS[rungName];
  const pattern = encode(n);
  const carried = rung.voice(pattern);        // voiced on this rung's carrier
  const heard = rung.hear(carried);           // recovered pattern from the carrier
  const { n: back, ok } = decode(heard);      // decoded number
  return { pattern, carried, heard, n: back, ok: ok && back === (n >>> 0) };
}

export default { KAPPA, sig, encode, decode, sound, radio, light, RUNGS, roundtrip, VER, FRAME };
