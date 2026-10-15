// clog-decrypter-wasm — AssemblyScript port of clog-decrypter (clog_decomp.py).
//
// Algorithm (identical to the Python original): in-place repeating-key XOR.
//   out[i] = in[i] ^ key[i % 128]
//
// The 128-byte key below is copied EXACTLY from clog_decomp.py lines 26-35.
// Known bug in the Python CLI at line 44 (`hel_p=` argparse typo) is NOT
// reproduced here — this module implements only the decrypt loop.
//
// No runtime allocation is used: the key lives in a static wasm data segment
// via memory.data<u8>(), and decrypt() XORs bytes in place at the caller's
// offset. JS writes file bytes at DATA_OFFSET (see web/main.js), grows the
// exported memory itself, and re-creates its Uint8Array views after growing.

/// Key length in bytes. Exported so JS can sanity-check.
export const KEY_LEN: usize = 128;

// Static data segment: zero runtime allocation, fixed address in wasm memory.
const KEY_PTR: usize = memory.data<u8>([
  130, 135, 151, 64, 141, 139, 70, 11, 187, 115, 148, 3, 229, 179, 131, 83,
  105, 107, 131, 218, 149, 175, 74, 35, 135, 229, 151, 172, 36, 88, 175, 54,
  78, 225, 90, 249, 241, 1, 75, 177, 173, 182, 76, 76, 250, 116, 40, 105,
  194, 139, 17, 23, 213, 182, 71, 206, 179, 183, 205, 85, 254, 249, 193, 36,
  255, 174, 144, 46, 73, 108, 78, 9, 146, 129, 78, 103, 188, 107, 156, 222,
  177, 15, 104, 186, 139, 128, 68, 5, 135, 94, 243, 78, 254, 9, 151, 50,
  192, 173, 159, 233, 187, 253, 77, 6, 145, 80, 137, 110, 224, 232, 238, 153,
  83, 0, 60, 166, 184, 34, 65, 50, 177, 189, 245, 40, 80, 224, 114, 174
]);

/// Address of the embedded key in wasm memory. JS can read KEY_LEN bytes here
/// to verify the key matches the original tool.
export function getKeyPtr(): usize {
  return KEY_PTR;
}

/// In-place repeating-key XOR over the byte range [ptr, ptr + len).
/// The caller owns the buffer at `ptr`; no allocation happens inside.
export function decrypt(ptr: usize, len: usize): void {
  // `i & 127` == `i % 128` for non-negative i, and matches the Python
  // `index = (index + 1) % len(key)` wrap-around exactly.
  for (let i: usize = 0; i < len; i++) {
    store<u8>(ptr + i, load<u8>(ptr + i) ^ load<u8>(KEY_PTR + (i & 127)));
  }
}
