import {
  Command,
  CommandErrorBase,
  CommandErrors,
  CommandsBase,
  ModuleFunction,
  ModuleFunctionBase,
  RFLinkProfile,
  RFLinkProfilesBase,
} from "./constants.js";
import type { ProtocolControl } from "./interfaces.js";

/**
 * Get short name for command code.
 *
 * @param commandCode - Command code
 * @returns description
 */
export const getCommandName = (commandCode: Command) =>
  Object.entries(Command).find(([_, v]) => v === commandCode)?.[0] || `Unknown command 0x[${commandCode.toString(16)}]`;

/**
 * Get short name for module function code.
 *
 * @param functionCode - Module function code
 * @returns description
 */
export const getModuleFunctionName = (functionCode: ModuleFunction) =>
  Object.entries(ModuleFunction).find(([_, v]) => v === functionCode)?.[0] ||
  `Unknown module function 0x[${functionCode.toString(16)}]`;

/**
 * Get short name for error code.
 *
 * @param errorCode - Error code
 * @returns description
 */
export const getErrorName = (errorCode: CommandErrors) =>
  Object.entries(CommandErrors).find(([_, v]) => v === errorCode)?.[0] || `Unknown error 0x[${errorCode.toString(16)}]`;

/**
 * Get description for command code.
 *
 * @param commandCode - Command code
 * @returns description
 */
export const getCommandDescription = (commandCode: Command) =>
  Object.entries(CommandsBase).find(([_, v]) => v[0] === commandCode)?.[1][1] ||
  `Unknown command 0x[${commandCode.toString(16)}]`;

/**
 * Get description for RF Link Profile code.
 *
 * @param profileCode - RF Link Profile code
 * @returns description
 */
export const getRFLinkProfileDescription = (profileCode: RFLinkProfile) =>
  Object.entries(RFLinkProfilesBase).find(([_, v]) => v[0] === profileCode)?.[1][1] ||
  `Unknown RF link profile 0x[${profileCode.toString(16)}]`;

/**
 * Get description for module function code.
 *
 * @param functionCode - Module function code
 * @returns description
 */
export const getModuleFunctionDescription = (functionCode: ModuleFunction) =>
  Object.entries(ModuleFunctionBase).find(([_, v]) => v[0] === functionCode)?.[1][1] ||
  `Unknown module function 0x[${functionCode.toString(16)}]`;

/**
 * Get description for error code.
 *
 * @param errorCode - Error code
 * @returns description
 */
export const getErrorDescription = (errorCode: CommandErrors) =>
  Object.entries(CommandErrorBase).find(([_, v]) => v[0] === errorCode)?.[1][1] ||
  `Unknown error 0x[${errorCode.toString(16)}]`;

/**
 * Ensure number can be stored in a byte.
 *
 * @param num - Number to check
 * @throws {@link RangeError} if number cannot be stored in a byte.
 */
export function ensureByteSize(num: number): void | never {
  if (num < 0 || num > 255) throw new RangeError("Argument cannot be stored in a byte.");
}

/**
 * Ensure array length.
 *
 * @param minLen - Minimum array length
 * @param maxLen - Maximum array length (defaults to `len`)
 * @throws {@link RangeError} if array is not required length
 */
export function ensureArrayLength(array: Uint8Array, minLen: number, maxLen?: number): void | never {
  if (array.length < minLen || array.length > (maxLen ?? minLen)) throw new RangeError("Invalid array length.");
}

/**
 * ISO 1155 longitudinal redundancy check.
 *
 * @param bytes - Data to generate LRC for
 * @returns one byte LRC
 */
export function iso1155LRC(bytes: number[] | Uint8Array) {
  let uSum = new Uint8Array(1);
  for (const byte of bytes) uSum[0] -= byte;
  return uSum[0]!;
}

/**
 * Convert number to hex string.
 *
 * @param num - number to convert
 * @returns hexidecimal string
 */
export function numToHexStr(num: number) {
  const str = num.toString(16);
  return str.length % 2 ? "0" + str : str;
}

/**
 * Parse Protocol Control word.
 *
 * @param pcWord - Protocol Control word
 * @returns `ProtocolControl`
 */
export function parseProtocolControlWord(pcWord: number) {
  return {
    epcLength: ((pcWord & 0xf800) >>> 10) & 0x3e,
    umi: (pcWord & 0x0400) >>> 10 == 1,
    xi: (pcWord & 0x0200) >>> 9 == 1,
    t: (pcWord & 0x0100) >>> 8 == 1,
  } as ProtocolControl;
}
