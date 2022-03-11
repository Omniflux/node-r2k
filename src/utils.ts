
export function checksum(bytes: number[] | Uint8Array) {
  let uSum = 0;
  for (const byte of bytes) {
    uSum = (uSum + byte) & 0xFF;
  }
  uSum = ((~uSum) + 1) & 0xFF;
  return uSum;
}