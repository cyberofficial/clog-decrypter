// clog-decrypter-wasm — web demo glue.
// Loads clog_decrypt.wasm, decrypts a dropped/selected file fully locally,
// shows a text/hex preview, and offers a .txt download named like the
// original Python tool: basename(input) + ".txt".

'use strict';

// ---------------------------------------------------------------------------
// Wasm loading
// ---------------------------------------------------------------------------

let wasm = null;      // instantiated WebAssembly exports
let memory = null;    // exported WebAssembly.Memory

async function loadWasm() {
  const res = await fetch('clog_decrypt.wasm');
  if (!res.ok) throw new Error('fetch clog_decrypt.wasm -> HTTP ' + res.status);
  const bytes = await res.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasm = instance.exports;
  memory = wasm.memory;
  if (!memory || !wasm.decrypt || !wasm.getKeyPtr) {
    throw new Error('wasm exports missing (need memory, decrypt, getKeyPtr)');
  }
}

// ---------------------------------------------------------------------------
// Memory layout convention (documented here, shared with test.mjs)
// ---------------------------------------------------------------------------
// AssemblyScript static data (the embedded 128-byte key segment and runtime
// flags) lives in the first few KiB of linear memory. We place file payloads
// at a fixed 1 MiB offset — far above any AS static data — so the two can
// never overlap. decrypt() XORs in place at this offset; nothing allocates.
const DATA_OFFSET = 0x100000; // 1 MiB
const PAGE = 65536;           // wasm page size

// Grow exported memory to fit `len` bytes at DATA_OFFSET, then return a fresh
// Uint8Array view over the payload region. Views are ALWAYS re-created after
// grow(): growing detaches the old ArrayBuffer, so stale views would throw.
function payloadView(len) {
  const pagesNeeded = Math.ceil((DATA_OFFSET + len) / PAGE);
  const pagesHave = memory.buffer.byteLength / PAGE;
  if (pagesNeeded > pagesHave) memory.grow(pagesNeeded - pagesHave);
  return new Uint8Array(memory.buffer, DATA_OFFSET, len);
}

// ---------------------------------------------------------------------------
// Decrypt pipeline
// ---------------------------------------------------------------------------

function decryptBytes(bytes) {
  const view = payloadView(bytes.length);
  view.set(bytes);            // copy file into wasm memory at DATA_OFFSET
  wasm.decrypt(DATA_OFFSET, bytes.length);
  return view;                // view over the now-XORed wasm memory
}

function basename(name) {
  // Mirrors Python os.path.basename + " .txt" suffix of the original tool:
  // "foo.clog" -> "foo.clog.txt" (the original does NOT strip the extension).
  return name.split(/[\\/]/).pop() + '.txt';
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const downloadBtn = document.getElementById('download-btn');
const hexToggle = document.getElementById('hex-toggle');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileinput');

let lastResult = null; // { bytes: Uint8Array, outName: string }

function toHexPreview(bytes, maxBytes = 4096) {
  const lines = [];
  for (let off = 0; off < Math.min(bytes.length, maxBytes); off += 16) {
    const slice = bytes.subarray(off, Math.min(off + 16, bytes.length));
    const hex = Array.from(slice, b => b.toString(16).padStart(2, '0')).join(' ');
    lines.push(off.toString(16).padStart(8, '0') + '  ' + hex);
  }
  if (bytes.length > maxBytes) lines.push('… (' + (bytes.length - maxBytes) + ' more bytes)');
  return lines.join('\n');
}

function toTextPreview(bytes) {
  // Best-effort UTF-8 decode; clog content is plain text when decrypted.
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 65536));
}

async function handleFile(file) {
  if (!wasm) { statusEl.textContent = 'WASM not loaded yet.'; return; }
  statusEl.textContent = 'Decrypting ' + file.name + ' (' + file.size + ' bytes)…';
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const result = decryptBytes(buf);
    lastResult = { bytes: result, outName: basename(file.name) };
    previewEl.textContent = hexToggle.checked ? toHexPreview(result) : toTextPreview(result);
    statusEl.textContent = 'Decrypted ' + file.size + ' bytes of ' + file.name +
      ' — download as ' + lastResult.outName;
    downloadBtn.disabled = false;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    downloadBtn.disabled = true;
  }
}

downloadBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([lastResult.bytes], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastResult.outName; // <original-name>.txt, like the original tool
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

hexToggle.addEventListener('change', () => {
  if (lastResult) previewEl.textContent = hexToggle.checked ? toHexPreview(lastResult.bytes) : toTextPreview(lastResult.bytes);
});

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

loadWasm()
  .then(() => { statusEl.textContent = 'Ready — drop a .clog file (wasm loaded, ' + (memory.buffer.byteLength / 1048576) + ' MiB memory).'; })
  .catch(err => { statusEl.textContent = 'Failed to load wasm: ' + err.message; });
