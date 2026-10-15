// Node smoke test for web/clog_decrypt.wasm — no external deps.
// Run: node test.mjs   (from clog-decrypter-wasm/)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WASM_PATH = path.join(HERE, 'web', 'clog_decrypt.wasm');

// 128-byte XOR key — copied exactly from clog_decomp.py lines 26-35.
const EXPECTED_KEY = [
  130, 135, 151, 64, 141, 139, 70, 11, 187, 115, 148, 3, 229, 179, 131, 83,
  105, 107, 131, 218, 149, 175, 74, 35, 135, 229, 151, 172, 36, 88, 175, 54,
  78, 225, 90, 249, 241, 1, 75, 177, 173, 182, 76, 76, 250, 116, 40, 105,
  194, 139, 17, 23, 213, 182, 71, 206, 179, 183, 205, 85, 254, 249, 193, 36,
  255, 174, 144, 46, 73, 108, 78, 9, 146, 129, 78, 103, 188, 107, 156, 222,
  177, 15, 104, 186, 139, 128, 68, 5, 135, 94, 243, 78, 254, 9, 151, 50,
  192, 173, 159, 233, 187, 253, 77, 6, 145, 80, 137, 110, 224, 232, 238, 153,
  83, 0, 60, 166, 184, 34, 65, 50, 177, 189, 245, 40, 80, 224, 114, 174
];

// Same layout convention as web/main.js: payload at 1 MiB, above AS static data.
const DATA_OFFSET = 0x100000;
const PAGE = 65536;

function payloadView(memory, len) {
  const pagesNeeded = Math.ceil((DATA_OFFSET + len) / PAGE);
  const pagesHave = memory.buffer.byteLength / PAGE;
  if (pagesNeeded > pagesHave) memory.grow(pagesNeeded - pagesHave);
  return new Uint8Array(memory.buffer, DATA_OFFSET, len);
}

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

const bytes = await readFile(WASM_PATH);
const { instance } = await WebAssembly.instantiate(bytes, {});
const { memory, decrypt, getKeyPtr, KEY_LEN } = instance.exports;

check('exports memory', memory instanceof WebAssembly.Memory);
check('exports decrypt', typeof decrypt === 'function');
check('exports getKeyPtr', typeof getKeyPtr === 'function');
check('exports KEY_LEN == 128', Number(KEY_LEN) === 128, 'KEY_LEN=' + KEY_LEN);

// 1) Embedded key must equal the Python original byte-for-byte.
const keyBytes = new Uint8Array(memory.buffer, getKeyPtr(), 128);
check('embedded key == clog_decomp.py key', keyBytes.every((b, i) => b === EXPECTED_KEY[i]));

// 2) Small known buffer (300 bytes -> spans key wrap 128 twice + 44).
{
  const N = 300;
  const input = new Uint8Array(N, 0);
  for (let i = 0; i < N; i++) input[i] = (i * 7 + 13) & 0xff;
  const expected = new Uint8Array(N);
  for (let i = 0; i < N; i++) expected[i] = input[i] ^ EXPECTED_KEY[i % 128];

  const view = payloadView(memory, N);
  view.set(input);
  decrypt(DATA_OFFSET, N);
  check('decrypt 300-byte buffer', view.every((b, i) => b === expected[i]));

  // decrypt is an involution with the same key: re-encrypt gives the input back.
  decrypt(DATA_OFFSET, N);
  check('XOR involution (round-trip)', view.every((b, i) => b === input[i]));
}

// 3) 8 MiB+ path: memory.grow + re-created views must handle a big file.
{
  const N = 9 * 1024 * 1024; // 9 MiB > the 8 MiB requirement
  const input = new Uint8Array(N);
  for (let i = 0; i < N; i++) input[i] = (i * 31 + 7) & 0xff;
  const keyAt = i => EXPECTED_KEY[i & 127];

  const view = payloadView(memory, N);   // must grow beyond initial pages
  view.set(input);
  decrypt(DATA_OFFSET, N);
  let ok = true;
  for (let i = 0; i < N; i++) {
    if (view[i] !== (input[i] ^ keyAt(i))) { ok = false; console.log('first mismatch at ' + i); break; }
  }
  check('decrypt 9 MiB buffer (memory.grow path)', ok);
}

console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
