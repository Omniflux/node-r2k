
export function checksum(bytes: number[] | Uint8Array) {
  let uSum = new Uint8Array(1);
  for (const byte of bytes) {
    uSum[0] += byte;
  }
  uSum[0] = (~uSum[0]) + 1;
  return uSum[0];
}
