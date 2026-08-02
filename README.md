# airgap — a mesh that shares work by air, with no network

**▶ Live: https://sjgant80-hub.github.io/airgap/**

Air-gapped mesh compute. Nodes share work over **sound** (and light) — **no `fetch`, no `WebSocket`, no
`RTCPeerConnection`, no socket of any kind**. The mesh channel is the microphone and speaker, nothing else.
**Architecturally incapable of connecting to the internet:** there is no network code, so there is nothing
to hack over the wire.

This is the transmission ladder ([one-ladder](https://sjgant80-hub.github.io/one-ladder/), proven 17/17)
pointed at a real product: a **sovereign compute cell that only talks to what's in the room, by air.**

## Honest scope (a security claim, stated straight)

- **What's true:** the mesh removes the **network attack surface** — provable by grepping the source (zero
  network primitives) and demonstrable by turning wi-fi off and watching it still work. On hardware with no
  NIC, it is air-gapped by construction.
- **What is NOT claimed:** "unhackable" absolutely. The wire is gone; **the room isn't.** It remains exposed
  to acoustic eavesdropping/injection (anyone in earshot with a mic/speaker) and to host-OS compromise by
  other means. The honest, stronger claim: **unhackable over the wire, because there is no wire.**

## How it works

A message → 32-bit words → ladder frames (each a 10-nibble checksummed word) → **audible FSK tones**
(16 bins, 700–2500 Hz, + a sync preamble). Played out the speaker; heard by a mic; demodulated with a
Goertzel filter bank; reassembled; checksum-verified. On top: a **work protocol** — a node broadcasts
`WORK primes|10`, another hears it by air, computes it, and broadcasts `RESULT primes|2,3,5,…`. No internet,
ever, by design.

## Proven — `node test.mjs`, zero tokens, 17/17

- **Framing** — arbitrary messages survive frames → tones → back, **exact** (incl. UTF-8/emoji).
- **The mesh** — a node computes shared work (primes/fib/sum/sort) and answers; a full work-share round-trips
  entirely through frames (the air is the only transport).
- **Noise rejected** — a single flipped nibble is dropped by the checksum, never mis-read.
- **The air-gap invariant** — the kernel + codec contain **none of 10 network primitives** (checked against
  the code, comments stripped) and import no node network module. No code path to the wire.
- Fuzz — 2000 garbage inputs, 0 throws; random room noise fakes a valid 3-frame message **0/2000**.

The live page also runs an **offline self-test**: it renders the tones to real PCM audio and demodulates
them back — proving the acoustic modem end-to-end in the browser, no mic, no network.

## Files

`airgap.mjs` (framing + acoustic FSK + the work-mesh) · `ladder.mjs` (the vendored codec) · `test.mjs`
(17/17 gate) · `index.html` (the live PWA — self-test, audible transmit, mic listen + auto-answer work,
light carrier, no-network proof panel) · `sw.js` + `manifest.webmanifest`. Zero-dep, Node + browser.

```bash
node test.mjs                 # the proof
python -m http.server 8080    # then open http://localhost:8080 (two tabs = a mesh)
```
