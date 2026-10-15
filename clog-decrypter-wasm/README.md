# clog-decrypter-wasm

Browser-ready WebAssembly port of the `clog-decrypter` tool (`clog_decomp.py`).
It decrypts `.clog` files with a repeating-key XOR, entirely client-side — no
upload, no network after page load.

**No Rust is used anywhere in this project.** The module is written in
[AssemblyScript](https://www.assemblyscript.org/) (a TypeScript-like language
that compiles to WebAssembly). No `rustup`, no `cargo`, no Rust toolchain.

## Algorithm

Identical to the original Python tool: an in-place repeating-key XOR over the
whole input.

```
out[i] = in[i] ^ key[i % 128]
```

- `decrypt(ptr, len)` XORs each byte at `ptr..ptr+len` in place with
  `key[i & 127]` (`& 127` == `% 128` for non-negative `i`, matching the
  Python wrap-around `index = (index + 1) % len(key)`).
- The 128-byte key is embedded as a static wasm data segment
  (`memory.data<u8>(...)` in `src/main.ts`) — zero runtime allocation.
- The output file is named like the original tool: `basename(input) + ".txt"`
  (the original does NOT strip the `.clog` extension, so `foo.clog` →
  `foo.clog.txt`).
- The known bug in the Python CLI at `clog_decomp.py:44` (`hel_p=` argparse
  typo) is intentionally NOT reproduced; only the decrypt loop is ported.

### The full 128-byte XOR key

Copied exactly from `clog_decomp.py` lines 26–35:

```
130, 135, 151,  64, 141, 139,  70,  11, 187, 115, 148,   3, 229, 179, 131,  83,
105, 107, 131, 218, 149, 175,  74,  35, 135, 229, 151, 172,  36,  88, 175,  54,
 78, 225,  90, 249, 241,   1,  75, 177, 173, 182,  76,  76, 250, 116,  40, 105,
194, 139,  17,  23, 213, 182,  71, 206, 179, 183, 205,  85, 254, 249, 193,  36,
255, 174, 144,  46,  73, 108,  78,   9, 146, 129,  78, 103, 188, 107, 156, 222,
177,  15, 104, 186, 139, 128,  68,   5, 135,  94, 243,  78, 254,   9, 151,  50,
192, 173, 159, 233, 187, 253,  77,   6, 145,  80, 137, 110, 224, 232, 238, 153,
 83,   0,  60, 166, 184,  34,  65,  50, 177, 189, 245,  40,  80, 224, 114, 174
```

JS can verify it at runtime: read `KEY_LEN` (128) bytes from `getKeyPtr()` in
the exported wasm memory.

## Wasm exports

| Export       | Kind         | Purpose                                              |
|--------------|--------------|------------------------------------------------------|
| `memory`     | Memory       | linear memory; JS grows it and re-creates views      |
| `decrypt`    | `(ptr, len)` | in-place XOR over `[ptr, ptr+len)`                   |
| `getKeyPtr`  | `() -> u32`  | address of the embedded key                          |
| `KEY_LEN`    | const `128`  | key length for JS-side verification                  |

**Memory layout convention** (see `web/main.js` / `test.mjs`): AssemblyScript
static data (the key segment) lives in the first few KiB of linear memory, so
file payloads are written at a fixed `DATA_OFFSET = 1 MiB` — the two can never
overlap. Files up to well over 8 MiB are supported: JS calls
`WebAssembly.Memory.grow()` and re-creates its `Uint8Array` views after
growing (growing detaches the old `ArrayBuffer`).

## Build

Requires Node ≥ 18 (used: v22). The compiled module is committed at
`web/clog_decrypt.wasm`, so the demo runs without building.

```
cd clog-decrypter-wasm
npm install
npm run build     # asc src/main.ts -o web/clog_decrypt.wasm --runtime stub -O3 --noAssert
```

`--runtime stub` is enough: nothing allocates at runtime — decrypt is pure
in-place XOR over caller-owned memory.

## Run the demo

Serve over HTTP (opening `index.html` via `file://` is blocked by CORS —
fetch cannot read local files that way):

```
cd clog-decrypter-wasm/web
python3 -m http.server 8099
# open http://localhost:8099
```

(or `npm run serve` from the project root). Then drop a `.clog` file onto the
page (or click to pick one). The decrypted text appears in the preview area
(a hex view is available via the checkbox), and the download button saves
`<original-name>.txt` — the same output name the Python tool produces.
Everything happens locally in the browser.

## Test

Node smoke test (`test.mjs`): checks the exported key against the Python
original byte-for-byte, decrypts a 300-byte known buffer (spans the key wrap
twice), verifies the XOR round-trip, and decrypts a 9 MiB buffer through the
`memory.grow()` path.

```
cd clog-decrypter-wasm
npm test        # node test.mjs
```

## Files

```
clog-decrypter-wasm/
├── package.json          # build/test/serve scripts, assemblyscript dev dep
├── src/main.ts           # AssemblyScript source (key + decrypt)
├── web/
│   ├── clog_decrypt.wasm # compiled module (committed)
│   ├── index.html        # demo page
│   └── main.js           # loader + UI glue
├── test.mjs              # node smoke test
└── README.md
```
