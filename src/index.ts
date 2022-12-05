import Debug from "debug";

import { PacketLengthParser } from "@serialport/parser-packet-length";
import { crc16ccitt } from "crc";
import { EventEmitter } from "eventemitter3";
import { SerialPort } from "serialport";
import type { SetOptional } from "type-fest";

import {
  Address,
  AntennaDetector,
  AntennaID,
  BaudRate,
  BeeperMode,
  Command,
  CommandErrors,
  CommandReturnsError,
  DefaultResponseTimeout,
  DenseReaderMode,
  EPCMatch,
  FastID,
  FrequencyRegion,
  FrequencyTable,
  FrequencyTableIndex,
  GET_MASKS,
  GPIOLevel,
  GPIOReadable,
  GPIOWritable,
  IdentifierLength,
  InventoriedFlag,
  ISO180006BUIDLength,
  LockMemoryBank,
  LockType,
  MaskID,
  MemoryBank,
  ModuleFunction,
  OutputPower,
  PacketHeader,
  PhaseMode,
  Range,
  ResetTime,
  ReturnsError,
  RFLinkProfile,
  RSSIOffset,
  SelectedFlag,
  SessionID,
} from "./constants.js";
import type {
  AccessEPCMatch,
  AntennaSwitchingSequence,
  BufferedInventoriedTag,
  BufferedInventoryResult,
  CustomFrequencyBand,
  FastSwitchAntenna,
  FrequencyBand,
  Inventoried6BTag,
  InventoriedTag,
  Inventory6BResult,
  InventoryResult,
  KillTag,
  Lock6BResult,
  LockTag,
  QueryLock6BResult,
  R2KReaderEvents,
  Read6BResult,
  ReadTag,
  ResponseCallback,
  ResponseData,
  TagMask,
  Write6BResult,
  WriteTag,
} from "./interfaces.js";
import {
  ensureArrayLength,
  ensureByteSize,
  getCommandName,
  getErrorDescription,
  getModuleFunctionName,
  getRFLinkProfileDescription,
  iso1155LRC,
  numToHexStr,
  parseProtocolControlWord,
} from "./utilities.js";

export {
  AntennaID,
  BaudRate,
  BeeperMode,
  DenseReaderMode,
  FastID,
  FrequencyRegion,
  FrequencyTableIndex,
  GPIOLevel,
  GPIOReadable,
  GPIOWritable,
  InventoriedFlag,
  LockMemoryBank,
  LockType,
  MaskID,
  MemoryBank,
  ModuleFunction,
  OutputPower,
  PhaseMode,
  RFLinkProfile,
  SelectedFlag,
  SessionID,
} from "./constants.js";
export {
  AccessEPCMatch,
  AntennaSwitchingSequence,
  BufferedInventoriedTag,
  BufferedInventoryResult,
  CustomFrequencyBand,
  FastSwitchAntenna,
  FrequencyBand,
  Inventory6BResult,
  InventoryResult,
  KillTag,
  Lock6BResult,
  LockTag,
  ProtocolControl,
  QueryLock6BResult,
  Read6BResult,
  ReadTag,
  TagMask,
  Write6BResult,
  WriteTag,
} from "./interfaces.js";
export { getModuleFunctionName, getRFLinkProfileDescription, parseProtocolControlWord } from "./utilities.js";

/**
 * Debug logger.
 */
const debug = Debug("node-r2k:debug");

/**
 * Communicate with an Impinj Indy R2000 reader.
 *
 * @example
 * ```typescript
 * const rdr = new R2KReader({path: '/dev/rfid'});
 *
 * rdr.on('antennaMissing', (antennaID) => {
 *   console.log(`Attempted to use disconnected antenna port ${antennaID}`);
 * });
 *
 * rdr.on('tagFound', (tag, when) => {
 *   console.log(`${when}: `, tag);
 * });
 *
 * await rdr.startRealTimeInventory(InventoryAlgorithmRepeat.MINIMUM);
 * ```
 */
export class R2KReader extends EventEmitter<R2KReaderEvents> {
  protected serialPort: SerialPort;
  protected responseCallbacks: ResponseCallback[] = [];

  /**
   * Collect responses that arrive in multiple packets.
   */
  protected queues: {
    [address: number]: {
      masks: TagMask[];
      inventory: BufferedInventoriedTag[];
      read: ReadTag[];
      write: WriteTag[];
      lock: LockTag[];
      kill: KillTag[];
    };
  } = {};

  /**
   * Tracks if phase is enabled during Command.CUSTOMIZED_SESSION_TARGET_INVENTORY
   */
  protected phaseMode: PhaseMode = PhaseMode.OFF;

  /**
   * Communicate with an Impinj Indy R2000 reader.
   *
   * @remarks
   * RS-485 multipoint network support is incomplete when using `Address.PUBLIC`.
   *
   * @param serialPort - See {@link serialport.SerialPortOpenOptions | SerialPortOpenOptions}
   * @param rs485Address - Reader address to communicate with
   */
  constructor(
    serialPort: SetOptional<ConstructorParameters<typeof SerialPort>[0], "baudRate">,
    protected rs485Address: number = Address.PUBLIC
  ) {
    super();
    this.serialPort = new SerialPort({ ...{ baudRate: 115200 }, ...serialPort });
    const parser = this.serialPort.pipe(new PacketLengthParser({ delimiter: PacketHeader }));
    parser.on("error", this.resetState.bind(this));
    parser.on("data", this.processResponsePacket.bind(this));
  }

  /**
   * Reset state.
   *
   * @internal
   */
  protected resetState() {
    debug(
      `Resetting state, pending handlers: `,
      this.responseCallbacks.map((x) => getCommandName(x.command))
    );
    this.responseCallbacks.forEach((h) => clearTimeout(h.timeout));
    this.responseCallbacks = [];
    this.queues = {};
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ResetTime);
  }

  /**
   * Send command to reader.
   *
   * @param command - Command code
   * @param data - Data to include
   * @param timeout - Milliseconds to wait for response before resetting state
   * @returns ResponseData
   *
   * @internal
   */
  protected async sendCommand(command: Command, data: readonly number[] = [], timeout = DefaultResponseTimeout) {
    const packetData = [
      PacketHeader,
      data.length + 3, // data + address + command + checksum
      this.rs485Address,
      command,
      ...data,
    ];
    const packet = Buffer.from([...packetData, iso1155LRC(packetData)]);

    debug(
      `Sending command: [&${numToHexStr(this.rs485Address)}] ${getCommandName(command)} (${numToHexStr(command)}) ${
        packet.byteLength
      } bytes, timeout = ${timeout} ms`
    );
    debug(`Writing ${packet.length} bytes to serial port:`, packet);
    this.serialPort.write(packet);

    return new Promise<ResponseData>((resolve, reject) => {
      const responseTimeout = setTimeout(() => {
        // Timeout occurs on Command.RESET when successful, otherwise an error is returned
        if (command === Command.RESET)
          resolve({
            length: 3,
            address: this.rs485Address,
            command: Command.RESET,
            data: Buffer.alloc(0),
            errorCode: undefined,
            success: true,
          });
        else reject(new Error(`Timeout waiting for ${getCommandName(command)}`));
      }, timeout);

      const resolveWrapper = (responseData: ResponseData) => {
        clearTimeout(responseTimeout);
        resolve(responseData);
      };

      this.responseCallbacks.push({ command, callback: resolveWrapper, timeout: responseTimeout });
    });
  }

  /**
   * Process packet data.
   *
   * @param packet - A single response packet in the format of
   * [PacketHeader, Length, Address, Command, Data, Checksum]
   * data is variable length, all other fields are 1 byte.
   *
   * @internal
   */
  protected processResponsePacket(packet: Buffer) {
    debug(`Received ${packet.length} bytes from serial port:`, packet);

    // Ensure packet has minimum number of bytes
    const length = packet[1]!;
    if (length < 4 || packet.length != length + 2) {
      // Address + Command + Data + Checksum
      debug(`Invalid packet data length: ${length} [${packet.length}] bytes`);
      return;
    }

    // Ensure packet LRC is valid
    const receivedLRC = packet.at(-1)!;
    const actualLRC = iso1155LRC(packet.subarray(0, -1))!;
    if (receivedLRC !== actualLRC) {
      debug(`Invalid packet checksum: ${numToHexStr(actualLRC)}, expected ${numToHexStr(receivedLRC)}`);
      return;
    }

    // Ensure packet is from expected address
    const address = packet[2]!;
    if (this.rs485Address != Address.PUBLIC && address != this.rs485Address) {
      debug(`Ignoring packet from address: ${numToHexStr(address)}`);
      return;
    }

    // Ensure packet is a response to a known command
    const command = packet[3] as Command;
    debug(
      `Response for command: [&${numToHexStr(address)}] ${getCommandName(command)} (${numToHexStr(command)}) ${
        length + 2
      } bytes`
    );
    if (!Object.values(Command).includes(command)) return;

    // Check if packet is an error response
    let dataIndex = 4;
    let errorCode;
    let skipCallback = false;

    if (
      CommandReturnsError[command] === ReturnsError.YES ||
      (CommandReturnsError[command] === ReturnsError.IF_SINGLE_BYTE_DATA && length === 4) ||
      // Handle poor protocol design
      (command === Command.GET_RF_LINK_PROFILE &&
        !Object.values(RFLinkProfile).includes(packet[dataIndex] as RFLinkProfile)) ||
      (command === Command.GET_RF_PORT_RETURN_LOSS &&
        packet[dataIndex] === CommandErrors.FAIL_TO_GET_RF_PORT_RETURN_LOSS) ||
      (command === Command.TAG_MASK && length === 4 && packet[dataIndex] != 0)
    ) {
      errorCode = packet[dataIndex++] as CommandErrors;
      debug(`Response is: ${getCommandName(command)}: ${getErrorDescription(errorCode)}`);
    } else if (command === Command.FAST_SWITCH_ANT_INVENTORY && length === 5) {
      // This is the only error case not returned to the callback.
      // It can occur multiple times while the command still succeeds.
      skipCallback = true;
      const antennaID = AntennaID[packet[4]!] as unknown as AntennaID;
      this.emit("antennaMissing", antennaID);
      debug(
        `Response is: ${getCommandName(command)}: ${getErrorDescription(packet[5] as CommandErrors)}: ${antennaID}`
      );
    }
    // Check if packet is of a multi response type
    else skipCallback = this.processMultiResponsePacketData(command, address, packet.subarray(dataIndex, -1));

    // Return response to initiating method
    if (!skipCallback) {
      if (!this.responseCallbacks.length)
        debug(`State out of sync, received unexpected response: ${getCommandName(command)}`);

      // Try to resynchronize in case of lost packets (loose cable, etc.)
      while (this.responseCallbacks.length) {
        const responseHandler = this.responseCallbacks.shift()!;
        if (responseHandler.command === command) {
          responseHandler.callback({
            length,
            address,
            command,
            data: packet.subarray(dataIndex, -1),
            errorCode,
            success:
              errorCode === undefined ||
              errorCode === CommandErrors.SUCCESS ||
              (errorCode === CommandErrors.BUFFER_IS_EMPTY_ERROR && command === Command.GET_AND_RESET_INVENTORY_BUFFER),
          });
          break;
        } else {
          debug(
            `State out of sync, expecting response to ${getCommandName(
              responseHandler.command
            )}, received ${getCommandName(command)}`
          );
          if (
            responseHandler.command === Command.GET_INVENTORY_BUFFER ||
            responseHandler.command === Command.GET_AND_RESET_INVENTORY_BUFFER
          )
            this.queues[address]!.inventory = [];
          else if (responseHandler.command === Command.TAG_MASK && packet.length > 13) this.queues[address]!.masks = [];
          else if (responseHandler.command === Command.READ) this.queues[address]!.read = [];
          else if (responseHandler.command === Command.WRITE || responseHandler.command === Command.WRITE_BLOCK)
            this.queues[address]!.write = [];
          else if (responseHandler.command === Command.LOCK) this.queues[address]!.lock = [];
          else if (responseHandler.command === Command.KILL) this.queues[address]!.kill = [];
        }
      }
    }
  }

  /**
   * Process multi response packet data.
   *
   * @param command - Command code
   * @param address - RS-485 address
   * @param data - data from packet between command and checksum fields
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processMultiResponsePacketData(command: Command, address: number, data: Buffer) {
    ensureByteSize(address);
    let skipCallback = false;

    this.queues[address] ??= {
      masks: [],
      inventory: [],
      read: [],
      write: [],
      lock: [],
      kill: [],
    };

    if (command === Command.ISO18000_6B_INVENTORY && data.length === 9)
      skipCallback = this.processCommand6BInventory(data, command);
    else if (
      (command === Command.REAL_TIME_INVENTORY ||
        command === Command.FAST_SWITCH_ANT_INVENTORY ||
        command === Command.CUSTOMIZED_SESSION_TARGET_INVENTORY) &&
      data.length > 7
    )
      skipCallback = this.processCommandInventory(data, command);
    else if (command === Command.GET_INVENTORY_BUFFER || command === Command.GET_AND_RESET_INVENTORY_BUFFER)
      skipCallback = this.processCommandGetInventoryBuffer(data, command, address);
    else if (command === Command.TAG_MASK && data.length > 7) skipCallback = this.processCommandTagMask(data, address);
    else if (command === Command.READ) skipCallback = this.processCommandRead(data, address);
    else if (command === Command.WRITE || command === Command.WRITE_BLOCK)
      skipCallback = this.processCommandWLK(data, this.queues[address]!.write);
    else if (command === Command.LOCK) skipCallback = this.processCommandWLK(data, this.queues[address]!.lock);
    else if (command === Command.KILL) skipCallback = this.processCommandWLK(data, this.queues[address]!.kill);

    return skipCallback;
  }

  /**
   * Process response to Command.ISO18000_6B_INVENTORY
   *
   * @param data - data from packet between command and checksum fields
   * @param command - command code
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommand6BInventory(data: Buffer, command: Command) {
    if (this.responseCallbacks[0]?.command === command) this.responseCallbacks[0].timeout.refresh();

    const tag = {
      antenna: data[0],
      uid: data.subarray(1),
    } as Inventoried6BTag;

    this.emit("tag6BFound", tag, new Date());
    return true;
  }

  /**
   * Process response to Command.REAL_TIME_INVENTORY || Command.FAST_SWITCH_ANT_INVENTORY || Command.CUSTOMIZED_SESSION_TARGET_INVENTORY
   *
   * @param data - data from packet between command and checksum fields
   * @param command - command code
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommandInventory(data: Buffer, command: Command) {
    if (this.responseCallbacks[0]?.command === command) this.responseCallbacks[0].timeout.refresh();

    // Phase field is incorrectly documented as preceding RSSI field in UHF RFID Reader Serial Interface Protocol V3.7
    const phaseOffset = this.phaseMode === PhaseMode.ON ? -2 : 0;

    const pc = data.readUInt16BE(1);
    const epc = data.subarray(3, -1 + phaseOffset);
    this.validatePCEPC(epc, pc);

    const tag = {
      pc: pc,
      epc: epc,
      rssi: (data.at(-1 + phaseOffset)! & 0x7f) + RSSIOffset,
      antenna: (data[0]! & 0x03) + 4 * (data.at(-1 + phaseOffset)! >> 7),
      frequency: (data[0]! & 0xfc) >> 2,
      ...(phaseOffset && { phaseAngle: data.readUInt16BE(data.length - 2) }),
    } as InventoriedTag;

    this.emit("tagFound", tag, new Date());
    return true;
  }

  /**
   * Process response to Command.GET_INVENTORY_BUFFER || Command.GET_AND_RESET_INVENTORY_BUFFER
   *
   * @param data - data from packet between command and checksum fields
   * @param command - command code
   * @param address - RS-485 address
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommandGetInventoryBuffer(data: Buffer, command: Command, address: number) {
    ensureByteSize(address);
    let skipCallback = false;
    const queue = this.queues[address]!.inventory;

    const pc = data.readUInt16BE(3);
    const epc = data.subarray(5, -5);
    const receivedCRC = data.readUInt16BE(data.length - 5);
    this.validateCRC(data.subarray(3, -5), receivedCRC);
    this.validatePCEPC(epc, pc);

    queue.push({
      pc: pc,
      epc: epc,
      crc: receivedCRC,
      rssi: (data.at(-3)! & 0x7f) + RSSIOffset,
      antenna: (data.at(-2)! & 0x03) + 4 * (data.at(-3)! >> 7),
      frequency: ((data.at(-2)! & 0xfc) >> 2) as FrequencyTableIndex,
      count: data.readUInt8(data.length - 1),
    });

    // No end of inventory packet unless reset, so count to track completion
    if (data.readUInt16BE(0) != queue.length || command === Command.GET_AND_RESET_INVENTORY_BUFFER) skipCallback = true;

    return skipCallback;
  }

  /**
   * Process response to Command.TAG_MASK
   *
   * @param data - data from packet between command and checksum fields
   * @param address - RS-485 address
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommandTagMask(data: Buffer, address: number) {
    ensureByteSize(address);
    let skipCallback = false;
    const queue = this.queues[address]!.masks;

    queue.push({
      maskID: data[0]!,
      target: data[2]!,
      action: data[3]!,
      membank: data[4]!,
      address: data[5]!,
      bitLength: data[6]!,
      mask: data.subarray(7),
    });

    // No end of masks packet, so count to track completion
    if (data.readUInt8(1) != queue.length) skipCallback = true;

    return skipCallback;
  }

  /**
   * Process response to Command.READ
   *
   * @param data - data from packet between command and checksum fields
   * @param address - RS-485 address
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommandRead(data: Buffer, address: number) {
    ensureByteSize(address);
    let skipCallback = false;
    const queue = this.queues[address]!.read;

    const readDataLength = data.readUInt8(data.length - 3);
    const pc = data.readUInt16BE(3);
    const epc = data.subarray(5, -5 - readDataLength);
    const receivedCRC = data.readUInt16BE(data.length - 5 - readDataLength);
    this.validateCRC(data.subarray(3, -5 - readDataLength), receivedCRC);
    this.validatePCEPC(epc, pc);

    queue.push({
      pc: pc,
      epc: epc,
      crc: receivedCRC,
      data: data.subarray(-3 - readDataLength, -3),
      antenna: (data.at(-2)! & 0x03) + 4 * (data.at(-1)! >> 7),
      frequency: ((data.at(-2)! & 0xfc) >> 2) as FrequencyTableIndex,
      count: data.at(-1)! & 0x7f,
    });

    // No end of read packet, so count to track completion
    if (data.readUInt16BE() != queue.length) skipCallback = true;

    return skipCallback;
  }

  /**
   * Process response to Command.WRITE || Command.WRITE_BLOCK || Command.LOCK || Command.KILL
   *
   * @param data - data from packet between command and checksum fields
   * @param queue - queue to save to
   * @returns `true` if processing of this packet is complete
   *
   * @internal
   */
  protected processCommandWLK(data: Buffer, queue: WriteTag[] | LockTag[] | KillTag[]) {
    let skipCallback = false;

    const pc = data.readUInt16BE(3);
    const epc = data.subarray(5, -5);
    const receivedCRC = data.readUInt16BE(data.length - 5);

    this.validateCRC(data.subarray(3, -5), receivedCRC);
    this.validatePCEPC(epc, pc);

    queue.push({
      pc: pc,
      epc: epc,
      crc: receivedCRC,
      antenna: (data.at(-2)! & 0x03) + 4 * (data.at(-1)! >> 7),
      frequency: ((data.at(-2)! & 0xfc) >> 2) as FrequencyTableIndex,
      errorCode: data.at(-3) as CommandErrors,
      count: data.at(-1)! & 0x7f,
    });

    // No end of command packet, so count to track completion
    if (data.readUInt16BE() != queue.length) skipCallback = true;

    return skipCallback;
  }

  /**
   * Validate PC + EPC CRC.
   *
   * @param data - data to validate
   * @param crc - CRC to validate
   * @returns `true` if CRC of data matches `crc`
   *
   * @internal
   */
  protected validateCRC(data: Buffer, crc: number) {
    const actualCRC = crc16ccitt(data) ^ 0xffff;
    if (crc !== actualCRC) debug(`Invalid data CRC: ${numToHexStr(actualCRC)}, expected ${numToHexStr(crc)}`);
    return crc === actualCRC;
  }

  /**
   * Validate Protocol Control data EPC length.
   *
   * @param epc - EPC to validate
   * @param pcWord - Protocol Control data
   * @returns `true` if EPC length matches length in pcWord
   *
   * @internal
   */
  protected validatePCEPC(epc: Buffer, pcWord: number) {
    const pcParsed = parseProtocolControlWord(pcWord);
    if (pcParsed.epcLength !== epc.length) debug(`Invalid EPC length: ${epc.length}, expected ${pcParsed.epcLength}`);
    return pcParsed.epcLength === epc.length;
  }

  //-------------------------------------------------
  // Public methods below
  //-------------------------------------------------

  /**
   * Resets reader.
   */
  async reset() {
    this.sendCommand(Command.RESET);
    this.resetState();
  }

  /**
   * Set reader baud rate.
   *
   * @remarks
   * Changes reader baud rate and resets reader.
   *
   * Saves to flash.
   *
   * @param baudRate - New baud rate [38400, 115200]
   * @returns `true` if successful
   */
  async setBaudRate(baudRate: BaudRate) {
    const baudRateCode = BaudRate[baudRate];
    if (baudRateCode)
      return this.sendCommand(Command.SET_UART_BAUDRATE, [baudRateCode]).then((res) => {
        if (res.success) {
          this.serialPort.update({ baudRate: baudRate });
          debug(`Set baud rate to: ${baudRate} bps`);
          this.resetState();
        }
        return res.success;
      });
    else debug(getCommandName(Command.SET_UART_BAUDRATE) + ": Baud rate must be one of " + Object.keys(BaudRate));
    return false;
  }

  /**
   * Get reader firmware version.
   *
   * @returns the firmware version of the reader.
   */
  async getFirmwareVersion() {
    return this.sendCommand(Command.GET_FIRMWARE_VERSION).then((res) => `${res.data[0]}.${res.data[1]}`);
  }

  /**
   * Set reader address for use on RS-485 multipoint network.
   *
   * @remarks
   * Changes address.
   *
   * WARNING!
   * Sending this command to `Address.PUBLIC` will set the address for all
   * connected readers identically. User will have to disconnect and reprogram
   * each reader individually to revert to unique addresses.
   *
   * Saves to flash.
   *
   * @param rs485Address - New address [0-255)
   * @returns `true` if successful
   */
  async setAddress(rs485Address: number) {
    ensureByteSize(rs485Address);
    return this.sendCommand(Command.SET_READER_ADDRESS, [rs485Address]).then((res) => {
      if (res.success) {
        this.rs485Address = rs485Address;
        debug(`Set address to: ${rs485Address}`);
      }
      return res.success;
    });
  }

  /**
   * Set working antenna port on reader.
   *
   * @remarks
   * Valid antenna ports depend on reader model
   *  AntennaID.A1:
   *   Rodinbell D-100, D-101, M-500, M-2600
   *   Invelion YR9010/IND9010, YR900/IND900, YR904/IND904
   *
   *  AntennaID.A1 - AntennaID.A4:
   *   Rodinbell M-2800, S-8600
   *   Invelion YR901/IND901, YR905/IND905
   *
   *  AntennaID.A1 - AntennaID.A8:
   *   Rodinbell M-2900, S-8800
   *   Invelion YR9051/IND9051
   *
   * @param antenna - New antenna port
   * @returns `true` if successful
   */
  async setWorkingAntenna(antenna: Exclude<AntennaID, AntennaID.DISABLED>) {
    return this.sendCommand(Command.SET_WORK_ANTENNA, [antenna]).then((res) => {
      if (res.success) debug(`Set antenna port to: ${antenna}`);
      return res.success;
    });
  }

  /**
   * Get working antenna port on reader.
   *
   * @returns current working antenna port
   */
  async getWorkingAntenna() {
    return this.sendCommand(Command.GET_WORK_ANTENNA).then((res) => res.data[0] as AntennaID);
  }

  /**
   * Set output power of antenna ports.
   *
   * @remarks
   * Changes output power for all antenna ports to the specified value.
   *
   * Takes > 100mS to complete.
   *
   * Saves to flash.
   * Use `setTemporaryOutputPower` when possible to reduce writes to flash.
   *
   * @param power - Power level in dBm [0-33 (0-26 for D-100, D-101, YR9010/IND9010)]
   * @returns `true` if successful
   *
   * {@label ALL}
   */
  async setOutputPower(power: OutputPower): Promise<boolean>;

  /**
   * Set output power of antenna ports.
   *
   * @remarks
   * Changes output power for antenna ports.
   *
   * Takes > 100mS to complete.
   *
   * Saves to flash.
   * Use `setTemporaryOutputPower` when possible to reduce writes to flash.
   *
   * @param power - Tuple of power levels in dBm [0-33]
   * @returns `true` if successful
   *
   * {@label 4P}
   */
  async setOutputPower(power: readonly [OutputPower, OutputPower, OutputPower, OutputPower]): Promise<boolean>;

  /**
   * {@inheritDoc setOutputPower.(:4P)}
   * {@label 8P}
   */
  async setOutputPower(
    power: readonly [
      OutputPower,
      OutputPower,
      OutputPower,
      OutputPower,
      OutputPower,
      OutputPower,
      OutputPower,
      OutputPower
    ]
  ): Promise<boolean>;

  /**
   * Overloaded implementation
   * @internal
   */
  async setOutputPower(power: OutputPower | readonly OutputPower[]) {
    return this.sendCommand(Command.SET_OUTPUT_POWER, Array.isArray(power) ? power : [power]).then((res) => {
      if (res.success) debug(`Set output power to: ${power}`);
      return res.success;
    });
  }

  /**
   * Get output power of antenna ports.
   *
   * @returns output power of antenna ports
   */
  async getOutputPower() {
    return this.sendCommand(Command.GET_OUTPUT_POWER).then(
      (res) => (res.data.length == 1 ? (Array(4).fill(res.data[0]) as OutputPower[]) : [...res.data]) as OutputPower[]
    );
  }

  /**
   * Get output power of antenna ports (8 port).
   *
   * @returns output power of antenna ports
   */
  async getOutputPower8P() {
    return this.sendCommand(Command.GET_OUTPUT_POWER_8P).then(
      (res) => (res.data.length == 1 ? Array(8).fill(res.data[0]) : [...res.data]) as OutputPower[]
    );
  }

  /**
   * Set region frequency band.
   *
   * @remarks
   * Frequency indexes are from `FrequencyTable`.
   *
   * @param region - Regulatory region
   * @param startFreqIdx - Start frequency index [0-60)
   * @param endFreqIdx - End frequency index [0-60), must be >= startFreqIdx
   * @returns `true` if successful
   */
  async setRegionFrequencyBand(
    region: FrequencyRegion,
    startFreqIdx?: FrequencyTableIndex,
    endFreqIdx?: FrequencyTableIndex
  ) {
    startFreqIdx ??= region === FrequencyRegion.FCC ? 7 : region === FrequencyRegion.ETSI ? 0 : 43;
    endFreqIdx ??= region === FrequencyRegion.FCC ? 59 : region === FrequencyRegion.ETSI ? 6 : 53;
    if (endFreqIdx < startFreqIdx) endFreqIdx = startFreqIdx;

    return this.sendCommand(Command.SET_FREQUENCY_REGION, [region, startFreqIdx, endFreqIdx]).then((res) => {
      if (res.success)
        debug(
          `Set region to: ${FrequencyRegion[region]}, band to: ${FrequencyTable[startFreqIdx!]}KHz-${
            FrequencyTable[endFreqIdx!]
          }KHz`
        );
      return res.success;
    });
  }

  /**
   * Set custom frequency band.
   *
   * @remarks
   * `freqSpace` is KHz divided by 10, so for 902.000 Mhz, 902.500 Mhz, a
   *  difference of 500 KHz, use a value of 50.
   *
   * @param startFreq - Start frequency in KHz [840000-960000]
   * @param freqSpace - Frequency spacing in KHz / 10 [0,256)
   * @param freqQuantity - Number of frequencies [0,256)
   * @returns `true` if successful
   */
  async setCustomFrequencyBand(startFreq: number, freqSpace: number, freqQuantity: number) {
    ensureByteSize(freqSpace);
    ensureByteSize(freqQuantity);
    const frequency = Buffer.allocUnsafe(3);
    frequency.writeUIntBE(startFreq, 0, 3);

    return this.sendCommand(Command.SET_FREQUENCY_REGION, [
      FrequencyRegion.CUSTOM,
      freqSpace,
      freqQuantity,
      ...frequency,
    ]).then((res) => {
      if (res.success) debug(`Set frequency band to: ${startFreq}KHz + ${freqQuantity}x${freqSpace}`);
      return res.success;
    });
  }

  /**
   * Get operating frequency band.
   *
   * @returns `CustomFrequencyBand` | `FrequencyBand`
   */
  async getFrequencyBand() {
    return this.sendCommand(Command.GET_FREQUENCY_REGION).then((res) => {
      if (res.data[0] === FrequencyRegion.CUSTOM) {
        return {
          freqSpace: res.data[1]! * 10,
          freqQuantity: res.data[2],
          startFreq: res.data.readUIntBE(3, 3),
        } as CustomFrequencyBand;
      } else {
        return {
          region: res.data[0],
          startFreq: res.data[1],
          endFreq: res.data[2],
        } as FrequencyBand;
      }
    });
  }

  /**
   * Set beeper mode.
   *
   * @remarks
   * `BeeperMode.TAG` consumes significant CPU time and negatively affects
   * the anti-collision algorithm. Recommended for use only during testing.
   *
   * Saves to flash.
   *
   * @param mode - Beeper mode
   * @returns `true` if successful
   */
  async setBeeperMode(mode: BeeperMode) {
    return this.sendCommand(Command.SET_BEEPER_MODE, [mode]).then((res) => {
      if (res.success) debug(`Set beeper mode to: ${BeeperMode[mode]}`);
      return res.success;
    });
  }

  /**
   * Get reader temperature.
   *
   * @returns temperature in degrees Celcius or `false` on error
   */
  async getTemperature() {
    return this.sendCommand(Command.GET_READER_TEMPERATURE).then((res) => {
      if (res.success) return (res.data[0] ? 1 : -1) * res.data[1]!;
      return false;
    });
  }

  /**
   * Get GPIO level.
   *
   * @param gpio - GPIO # to read
   * @returns GPIO level
   */
  async getGPIOLevel(gpio: GPIOReadable) {
    return this.sendCommand(Command.GET_GPIO_VALUE).then((res) => res.data[gpio] as GPIOLevel);
  }

  /**
   * Set GPIO level.
   *
   * @param gpio - GPIO # to set
   * @param level - GPIP level to set
   * @returns `true` if successful
   */
  async setGPIOLevel(gpio: GPIOWritable, level: GPIOLevel) {
    return this.sendCommand(Command.SET_GPIO_VALUE, [gpio, level]).then((res) => {
      if (res.success) debug(`Set ${GPIOWritable[gpio]} to: ${GPIOLevel[level]}`);
      return res.success;
    });
  }

  /**
   * Set antenna detector sensitivity for working antenna port.
   *
   * @remarks
   * Recommend 3-6dB for most antennas.
   *
   * @param threshold - return loss threshold in dB [1,256) and AntennaDetector.DISABLED
   * @returns `true` if successful
   */
  async setAntennaDetectorSensitivity(threshold: number | AntennaDetector.DISABLED) {
    ensureByteSize(threshold);
    return this.sendCommand(Command.SET_ANT_CONNECTION_DETECTOR, [threshold]).then((res) => {
      if (res.success)
        debug(
          threshold
            ? `Set antenna detector threshold for working antenna to ${threshold}dB`
            : "Disabled antenna detector for working antenna"
        );
      return res.success;
    });
  }

  /**
   * Get antenna detector sensitivity for working antenna port.
   *
   * @returns return loss threshold in dB
   */
  async getAntennaDetectorSensitivity(): Promise<number> {
    return this.sendCommand(Command.GET_ANT_CONNECTION_DETECTOR).then((res) => res.data[0]!);
  }

  /**
   * Set output power of working antenna port temporarily.
   *
   * @remarks
   * Changes output power for working antenna port.
   *
   * Protocol documentation states 20 is the minimum value, however
   * reader accepts any value 0-33 without error.
   *
   * Takes < 10uS to complete.
   *
   * @param power - Power level in dBm [20-33 (20-26 for D-100, D-101, YR9010/IND9010)]
   * @returns `true` if successful
   */
  async setTemporaryOutputPower(power: Exclude<OutputPower, Range<OutputPower.MINIMUM, OutputPower.MIN_TEMPORARY>>) {
    return this.sendCommand(Command.SET_TEMPORARY_OUTPUT_POWER, [power]).then((res) => {
      if (res.success) debug(`Set output power for working antenna to: ${power}dBm`);
      return res.success;
    });
  }

  /**
   * Set reader identifier.
   *
   * Saves to flash.
   *
   * @param identifier - New identifier (12 bytes)
   * @returns `true` if successful
   */
  async setIdentifier(identifier: Uint8Array) {
    ensureArrayLength(identifier, IdentifierLength);

    return this.sendCommand(Command.SET_READER_IDENTIFIER, [...identifier]).then((res) => {
      if (res.success) debug(`Set identifier to: ${Buffer.from(identifier).toString("hex")}`);
      return res.success;
    });
  }

  /**
   * Get reader identifier.
   *
   * @returns reader identifier
   */
  async getIdentifier() {
    return this.sendCommand(Command.GET_READER_IDENTIFIER).then((res) => res.data);
  }

  /**
   * Set RF link profile.
   *
   * @remarks
   * Changes RF link profile and resets reader.
   *
   * Recommend RFLinkProfile.P1.
   *
   * Saves to flash.
   *
   * @param profile - New profile
   * @returns `true` if successful
   */
  async setRFLinkProfile(profile: RFLinkProfile) {
    return this.sendCommand(Command.SET_RF_LINK_PROFILE, [profile]).then((res) => {
      if (res.success) debug(`Set RF Link Profile to: ${getRFLinkProfileDescription(profile)}`);
      return res.success;
    });
  }

  /**
   * Get RF Link Profile.
   *
   * @returns RF Link Profile or `false` on error
   */
  async getRFLinkProfile(): Promise<RFLinkProfile | false> {
    return this.sendCommand(Command.GET_RF_LINK_PROFILE).then((res) => {
      if (res.success) return res.data[0] as RFLinkProfile;
      return false;
    });
  }

  /**
   * Get working antenna port return loss at specified frequency.
   *
   * @remarks
   * Frequency indexes are from `FrequencyTable`.
   * Referenced frequency must be valid in currently configured frequency band.
   *
   * @param freqIdx - Frequency index
   * @returns return loss in dB of working antenna port at specified frequency or `false` on error
   */
  async getReturnLoss(freqIdx: FrequencyTableIndex) {
    return this.sendCommand(Command.GET_RF_PORT_RETURN_LOSS, [freqIdx]).then((res) => {
      if (res.success) return res.data[0] as number;
      return false;
    });
  }

  /**
   * Start ISO 18000-6C buffered inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * Set `repeat` to `InventoryDuration.MINIMUM` to optimize for small tag quantities.
   *
   * @param repeat - Number of times to repeat inventory algorithm [0, 256)
   * @returns `BufferedInventoryResult` or `false` on error
   */
  async startBufferedInventory(repeat: number) {
    ensureByteSize(repeat);
    const timeout = repeat * 255 + DefaultResponseTimeout; // A guess from observation

    return this.sendCommand(Command.INVENTORY, [repeat], timeout).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          tagCount: res.data.readUInt16BE(1),
          readRate: res.data.readUInt16BE(3),
          totalRead: res.data.readUInt32BE(5),
        } as BufferedInventoryResult;
      }
      return false;
    });
  }

  /**
   * Start ISO 18000-6C real time inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * Set `repeat` to `InventoryAlgorithmRepeat.MINIMUM` to optimize for small tag quantities.
   *
   * @param repeat - Number of times to repeat inventory algorithm [0, 256)
   * @returns `InventoryResult` or `false` on error
   */
  async startRealTimeInventory(repeat: number) {
    ensureByteSize(repeat);
    const timeout = repeat * 255 + DefaultResponseTimeout; // A guess from observation
    this.phaseMode = PhaseMode.OFF;

    return this.sendCommand(Command.REAL_TIME_INVENTORY, [repeat], timeout).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          readRate: res.data.readUInt16BE(1),
          totalRead: res.data.readUInt32BE(3),
        } as InventoryResult;
      }
      return false;
    });
  }

  /**
   * Start ISO 18000-6C session inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param repeat - Number of times to repeat inventory algorithm [0, 256)
   * @param session - Session ID
   * @param target - Inventoried flag
   * @param select - Select flag - actually round (stay, loop, ...)
   * @param phase - Phase state
   * @param powersave - Powersave [0, 256)
   * @returns `InventoryResult` or `false` on error
   */
  async startSessionInventory(
    repeat: number,
    session: SessionID,
    target: InventoriedFlag,
    select?: SelectedFlag,
    phase?: PhaseMode,
    powersave?: number
  ) {
    ensureByteSize(repeat);
    if (powersave) ensureByteSize(powersave);
    const timeout = repeat * 64 + (powersave ? powersave * 64 : 0) + DefaultResponseTimeout; // A guess from observation
    const data: number[] = [session, target];
    this.phaseMode = phase ?? PhaseMode.OFF;

    if (select !== undefined) {
      data.push(select);
      if (phase !== undefined) {
        data.push(phase);
        if (powersave !== undefined) data.push(powersave);
      }
    }
    data.push(repeat);

    return this.sendCommand(Command.CUSTOMIZED_SESSION_TARGET_INVENTORY, data, timeout).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          readRate: res.data.readUInt16BE(1),
          totalRead: res.data.readUInt32BE(3),
        } as InventoryResult;
      }
      return false;
    });
  }

  /**
   * Start ISO 18000-6C fast switch antenna inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param repeat - Number of times to repeat inventory sequence [0, 256)
   * @param restInterval - Rest interval between switching antennas in ms [0, 256)
   * @param antennas - Tuple of [AntennaID, repeat [0, 256)]
   * @returns `InventoryResult` or `false` on error
   *
   * {@label 4P}
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [FastSwitchAntenna, FastSwitchAntenna, FastSwitchAntenna, FastSwitchAntenna]
  ): Promise<false | InventoryResult>;

  /**
   * {@inheritDoc startFastSwitchAntennaInventory.(:4P)}
   * {@label 8P}
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna
    ]
  ): Promise<false | InventoryResult>;

  /**
   * Start ISO 18000-6C fast switch antenna inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param repeat - Number of times to repeat inventory sequence [0, 256)
   * @param restInterval - Rest interval between switching antennas in ms [0, 256)
   * @param antennas - Tuple of [AntennaID, repeat [0, 256)]
   * @param session - Session ID
   * @param target - Inventoried flag
   * @returns `InventoryResult` or `false` on error
   *
   * {@label 4P-Session}
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [FastSwitchAntenna, FastSwitchAntenna, FastSwitchAntenna, FastSwitchAntenna],
    session: SessionID,
    target: InventoriedFlag
  ): Promise<false | InventoryResult>;

  /**
   * {@inheritDoc startFastSwitchAntennaInventory.(:4P-Session)}
   * {@label 8P-Session}
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna
    ],
    session: SessionID,
    target: InventoriedFlag
  ): Promise<false | InventoryResult>;

  /**
   * Start ISO 18000-6C fast switch antenna inventory.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param repeat - Number of times to repeat inventory [0, 256)
   * @param restInterval - Rest interval between switching antennas in ms [0, 256)
   * @param antennas - Tuple of [AntennaID, repeat [0, 256)]
   * @param session - Session ID
   * @param target - Inventoried flag
   * @param phase - Phase state
   * @returns `InventoryResult` or `false` on error
   *
   * {@label 8P-Phase}
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna,
      FastSwitchAntenna
    ],
    session: SessionID,
    target: InventoriedFlag,
    phase: PhaseMode
  ): Promise<false | InventoryResult>;

  /**
   * Overloaded implementation
   * @internal
   */
  async startFastSwitchAntennaInventory(
    repeat: number,
    restInterval: number,
    antennas: readonly [
      FastSwitchAntenna,
      FastSwitchAntenna?,
      FastSwitchAntenna?,
      FastSwitchAntenna?,
      FastSwitchAntenna?,
      FastSwitchAntenna?,
      FastSwitchAntenna?,
      FastSwitchAntenna?
    ],
    session?: SessionID,
    target?: InventoriedFlag,
    phase?: PhaseMode
  ) {
    ensureByteSize(repeat);
    ensureByteSize(restInterval);
    const timeout = repeat * 255 + DefaultResponseTimeout; // A guess from observation
    this.phaseMode = phase ?? PhaseMode.OFF;

    const data = antennas.flatMap((x) => (x ? [x] : [])).flat();
    data.push(restInterval);
    if (antennas.length === 8 && session !== undefined && target !== undefined && phase !== undefined)
      data.push(0, 0, 0, 0, 0, session, target, 0, 0, 0, phase);
    data.push(repeat);

    return this.sendCommand(Command.FAST_SWITCH_ANT_INVENTORY, data, timeout).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          readRate: res.data.readUInt16BE(1),
          totalRead: res.data.readUInt32BE(3),
        } as InventoryResult;
      }
      return false;
    });
  }

  /**
   * Read ISO 18000-6C tags.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param memBank - MemoryBank to read
   * @param address - Start address (words) [0, 256)
   * @param length - Number of words to read [0, 256)
   * @returns `ReadTag[]` or `false` on error
   */
  async readTags(memBank: MemoryBank, address: number, length: number) {
    ensureByteSize(address);
    ensureByteSize(length);

    return this.sendCommand(Command.READ, [memBank, address, length]).then((res) => {
      // Receives only the last of multiple response packets here
      const read = this.queues[res.address]!.read;
      this.queues[res.address]!.read = [];
      return res.success ? read : false;
    });
  }

  /**
   * Write ISO 18000-6C tags.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param memBank - MemoryBank to write
   * @param address - Start address (words) [0, 256)
   * @param data - Data to write (bytes)
   * @param password - Access password (4 bytes)
   * @param blockWrite - Use BlockWrite method
   * @returns `true` if successful
   */
  async writeTags(
    memBank: MemoryBank,
    address: number,
    data: Uint8Array,
    password: Uint8Array = new Uint8Array(4),
    blockWrite = true
  ) {
    ensureByteSize(address);
    ensureArrayLength(password, 4);
    const wordData = data.length % 2 ? [...data, 0] : data;

    return this.sendCommand(blockWrite ? Command.WRITE_BLOCK : Command.WRITE, [
      ...password,
      memBank,
      address,
      wordData.length / 2,
      ...wordData,
    ]).then((res) => {
      // Receives only the last of multiple response packets here
      const write = this.queues[res.address]!.write;
      this.queues[res.address]!.write = [];
      return res.success ? write : false;
    });
  }

  /**
   * (Un)lock ISO 18000-6C tags.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param memBank - MemoryBank to (un)lock
   * @param operation - Operation to perform
   * @param password - Access password (4 bytes)
   * @returns `true` if successful
   */
  async lockTags(memBank: LockMemoryBank, operation: LockType, password: Uint8Array) {
    ensureArrayLength(password, 4);

    return this.sendCommand(Command.LOCK, [...password, memBank, operation]).then((res) => {
      // Receives only the last of multiple response packets here
      const lock = this.queues[res.address]!.lock;
      this.queues[res.address]!.lock = [];
      return res.success ? lock : false;
    });
  }

  /**
   * Kill ISO 18000-6C tags.
   *
   * @remarks
   * AKA 'EPC Class 1 Generation 2' AKA 'EPC C1G2' AKA 'EPC Gen 2'.
   *
   * @param password - Kill password (4 bytes)
   * @returns `true` if successful
   */
  async killTags(password: Uint8Array) {
    ensureArrayLength(password, 4);

    return this.sendCommand(Command.KILL, [...password]).then((res) => {
      // Receives only the last of multiple response packets here
      const kill = this.queues[res.address]!.kill;
      this.queues[res.address]!.kill = [];
      return res.success ? kill : false;
    });
  }

  /**
   * Clear access EPC match.
   *
   * @returns `true` if successful
   */
  async clearAccessEPCMatch() {
    return this.sendCommand(Command.SET_ACCESS_EPC_MATCH, [EPCMatch.DISABLED]).then((res) => {
      if (res.success) debug(`Cleared access EPC match`);
      return res.success;
    });
  }

  /**
   * Set access EPC match.
   *
   * @param epc - EPC to match [1, 62]
   * @returns `true` if successful
   */
  async setAccessEPCMatch(epc: Uint8Array) {
    ensureArrayLength(epc, 1, 62);
    const data = Buffer.alloc(epc.length);
    data.set(epc);

    return this.sendCommand(Command.SET_ACCESS_EPC_MATCH, [EPCMatch.ENABLED, epc.length, ...data]).then((res) => {
      if (res.success) debug(`Set access EPC match to: ${epc}`);
      return res.success;
    });
  }

  /**
   * Get access EPC match configuration.
   *
   * @returns access EPC match configuration
   */
  async getAccessEPCMatch() {
    return this.sendCommand(Command.GET_ACCESS_EPC_MATCH).then((res) => {
      const data: AccessEPCMatch = { status: res.data[0] as EPCMatch };
      if (data.status == EPCMatch.ENABLED) {
        data.epcLen = res.data[1]!;
        data.epc = res.data.subarray(2);
      }
      return data;
    });
  }

  /**
   * Set FastID state temporarily.
   *
   * @remarks
   * FastID (AKA FastTID AKA Monza) works with a subset of Monza tag types.
   *
   * It improves the performance of identifying tag TIDs by instructing the tag
   * to return the TID in addition to the EPC.
   *
   * (PC + EPC + EPC's CRC + TID) instead of (PC + EPC).
   *
   * @param state - Fast ID state
   * @returns `true` if successful
   */
  async setTemporaryFastID(state: FastID) {
    return this.sendCommand(Command.SET_IMPINJ_FAST_TID, [state]).then((res) => {
      if (res.success) debug(`Set FastID state to: ${FastID[state]}`);
      return res.success;
    });
  }

  /**
   * Set FastID state.
   *
   * @remarks
   * FastID (AKA FastTID AKA Monza) works with a subset of Monza tag types.
   *
   * It improves the performance of identifying tag TIDs by instructing the tag
   * to return the TID in addition to the EPC.
   *
   * (PC + EPC + EPC's CRC + TID) instead of (PC + EPC).
   *
   * Saves to flash.
   *
   * @param state - Fast ID state
   * @returns `true` if successful
   */
  async setFastID(state: FastID) {
    return this.sendCommand(Command.SET_AND_SAVE_IMPINJ_FAST_TID, [state]).then((res) => {
      if (res.success) debug(`Set FastID state to: ${FastID[state]}`);
      return res.success;
    });
  }

  /**
   * Get Impinj FastID state.
   *
   * @returns FastID state
   */
  async getFastID() {
    return this.sendCommand(Command.GET_IMPINJ_FAST_TID).then((res) => res.data[0] as FastID);
  }

  /**
   * Get antenna switching sequence.
   *
   * @returns `AntennaSwitchingSequence`
   */
  async getAntennaSwitchingSequence() {
    return this.sendCommand(Command.GET_ANT_SWITCH_SEQUENCE).then((res) => {
      const antData = Array.from(
        { length: 4 },
        (_, i) => res.data.subarray(0, -1).subarray(i * 2, i * 2 + 2) as unknown as FastSwitchAntenna
      );
      return {
        antennas: [...antData],
        restInterval: res.data[8],
      } as AntennaSwitchingSequence;
    });
  }

  /**
   * Set tag mask.
   *
   * @param mask - Mask to set
   * @returns `true` if successful
   */
  async setTagMask(mask: TagMask) {
    const data = Buffer.alloc(mask.mask.length);
    data.set(mask.mask);

    return this.sendCommand(Command.TAG_MASK, [
      mask.maskID,
      mask.target,
      mask.action,
      mask.membank,
      mask.address,
      mask.bitLength,
      ...data,
      0,
    ]).then((res) => {
      if (res.success) debug(`Set tag mask: ${mask}`);
      return res.success;
    });
  }

  /**
   * Clear tag mask.
   *
   * @remarks
   * Use MaskID.ALL to clear all masks
   *
   * @param mask - Mask to clear
   * @returns `true` if successful
   */
  async clearTagMask(mask: MaskID) {
    return this.sendCommand(Command.TAG_MASK, [mask]).then((res) => {
      if (res.success) debug(`Cleared tag mask: ${MaskID[mask]}`);
      return res.success;
    });
  }

  /**
   * Get tag mask.
   *
   * @returns `TagMasks[]`
   */
  async getTagMasks() {
    return this.sendCommand(Command.TAG_MASK, [GET_MASKS]).then((res) => {
      // Receives only the last of multiple response packets here
      const masks = this.queues[res.address]!.masks;
      this.queues[res.address]!.masks = [];
      return masks;
    });
  }

  /**
   * Get module function.
   *
   * @returns `ModuleFunction`
   */
  async getModuleFunction(): Promise<ModuleFunction> {
    return this.sendCommand(Command.GET_MODULE_FUNCTION).then((res) => res.data[0] as ModuleFunction);
  }

  /**
   * Sets module function and resets reader.
   *
   * Saves to flash.
   *
   * @returns `true` if successful
   */
  async setModuleFunction(moduleFunction: ModuleFunction) {
    return this.sendCommand(Command.SET_MODULE_FUNCTION, [moduleFunction]).then((res) => {
      if (res.success) {
        debug(`Set module function to: ${getModuleFunctionName(moduleFunction)}`);
        this.resetState();
      }
      return res.success;
    });
  }

  /**
   * Get dense reader mode.
   *
   * @returns `DenseReaderMode`
   */
  async getDenseReaderMode() {
    return this.sendCommand(Command.GET_DRM_MODE).then((res) => res.data[0] as DenseReaderMode);
  }

  /**
   * Set dense reader mode.
   *
   * @returns `true` if successful
   */
  async setDenseReaderMode(mode: DenseReaderMode) {
    return this.sendCommand(Command.SET_DRM_MODE, [mode]).then((res) => {
      if (res.success) debug(`Set dense reader mode: ${DenseReaderMode[mode]}`);
      return res.success;
    });
  }

  /**
   * Start ISO 18000-6B real time inventory.
   *
   * @returns `Inventory6BResult` or `false` on error
   */
  async start6BRealTimeInventory() {
    return this.sendCommand(Command.ISO18000_6B_INVENTORY).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          tagCount: res.data[1],
        } as Inventory6BResult;
      }
      return false;
    });
  }

  /**
   * Read ISO 18000-6B tag.
   *
   * @param uid - UID of tag (8 bytes)
   * @param address - Start address [0,256)
   * @param length - Number of bytes to read [0,256)
   * @returns `Read6BResult` or `false` on error
   */
  async read6BTag(uid: Uint8Array, address: number, length: number) {
    ensureByteSize(address);
    ensureByteSize(length);
    ensureArrayLength(uid, ISO180006BUIDLength);

    return this.sendCommand(Command.ISO18000_6B_READ, [...uid, address, length]).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          data: res.data.subarray(1),
        } as Read6BResult;
      }
      return false;
    });
  }

  /**
   * Write ISO 18000-6B tag.
   *
   * @remarks
   * A partial write may occur, the number of bytes written is reported.
   *
   * @param uid - UID of tag (8 bytes)
   * @param address - Start address [0,256)
   * @param length - Number of bytes to write [0,256)
   * @param data - Data to write
   * @returns `Write6BResult` or `false` on error
   */
  async write6BTag(uid: Uint8Array, address: number, length: number, data: Uint8Array) {
    ensureByteSize(address);
    ensureByteSize(length);
    ensureArrayLength(uid, ISO180006BUIDLength);

    return this.sendCommand(Command.ISO18000_6B_READ, [...uid, address, length, ...data]).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          written: res.data[1],
        } as Write6BResult;
      }
      return false;
    });
  }

  /**
   * Lock byte in ISO 18000-6B tag.
   *
   * @param uid - UID of tag (8 bytes)
   * @param address - Address to lock [0,256)
   * @returns `Lock6BResult` or `false` on error
   */
  async lock6BTagByte(uid: Uint8Array, address: number) {
    ensureByteSize(address);
    ensureArrayLength(uid, ISO180006BUIDLength);

    return this.sendCommand(Command.ISO18000_6B_READ, [...uid, address]).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          status: res.data[1],
        } as Lock6BResult;
      }
      return false;
    });
  }

  /**
   * Query lock byte in ISO 18000-6B tag.
   *
   * @param uid - UID of tag (8 bytes)
   * @param address - Address to query [0,256)
   * @returns `QueryLock6BResult` or `false` on error
   */
  async queryLock6BTagByte(uid: Uint8Array, address: number) {
    ensureByteSize(address);
    ensureArrayLength(uid, ISO180006BUIDLength);

    return this.sendCommand(Command.ISO18000_6B_READ, [...uid, address]).then((res) => {
      if (res.success) {
        return {
          antenna: res.data[0],
          status: res.data[1],
        } as QueryLock6BResult;
      }
      return false;
    });
  }

  /**
   * Get inventory buffer.
   *
   * @param reset - Reset buffer when complete
   * @returns `BufferedInventoryTag[]`
   */
  async getInventoryBuffer(reset = false) {
    return this.sendCommand(reset ? Command.GET_AND_RESET_INVENTORY_BUFFER : Command.GET_INVENTORY_BUFFER).then(
      (res) => {
        // Receives only the last of multiple response packets here if reset
        const inventory = this.queues[res.address]!.inventory;
        this.queues[res.address]!.inventory = [];
        return res.success ? inventory : false;
      }
    );
  }

  /**
   * Get inventory buffer tag count.
   *
   * @returns number of tags in inventory buffer
   */
  async getInventoryBufferTagCount() {
    return this.sendCommand(Command.GET_INVENTORY_BUFFER_TAG_COUNT).then((res) => res.data.readUInt16BE());
  }

  /**
   * Reset inventory buffer.
   *
   * @returns `true` if successful
   */
  async resetInventoryBuffer() {
    return this.sendCommand(Command.RESET_INVENTORY_BUFFER).then((res) => {
      if (res.success) debug(`Reset inventory buffer`);
      return res.success;
    });
  }
}
