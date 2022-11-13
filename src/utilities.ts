import { Command, CommandDescription, ErrorDescription, RFLinkProfileDescription } from './constants'

export const getCommandName = (commandCode: Command) => Object.entries(Command).find(([_k, v]) => v === commandCode)?.[0] || `Unknown command 0x[${commandCode.toString(16)}]`;
export const getCommandDescription = (commandCode: Command) => CommandDescription[commandCode] || `Unknown command 0x[${commandCode.toString(16)}]`;
export const getErrorDescription = (errorCode: number) => ErrorDescription[errorCode] || `Unknown error 0x[${errorCode.toString(16)}]`;
export const getRFLinkProfileDescription = (profileCode: number) => RFLinkProfileDescription[profileCode] || `Unknown RF link profile 0x[${profileCode.toString(16)}]`;

// ISO 1155 longitudinal redundancy check
export function checksum(bytes: number[] | Uint8Array) {
  let uSum = new Uint8Array(1);

  for (const byte of bytes)
    uSum[0] -= byte;

    return uSum[0];
}
