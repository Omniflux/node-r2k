// Impinj R2000 ENUMS.
// Ported from https://github.com/hex-in/pyImpinj

export const TAG_MEMORY_BANK = {
  RESERVED : 0,
  EPC      : 1,
  TID      : 2,
  USER     : 3,
};

export const READER_ANTENNA = { 
  ANTENNA1 : 0,
  ANTENNA2 : 1,
  ANTENNA3 : 2,
  ANTENNA4 : 3,
  MAX      : 4,
};

const FREQUENCY_TABLES: number[] = [];

// 865 to 868
for (let x = 0; x < 7; ++x) FREQUENCY_TABLES.push(865 + x*0.5);

// 902 to 928
for (let x = 0; x < 53; ++x) FREQUENCY_TABLES.push(902 + x*0.5);

export { FREQUENCY_TABLES };