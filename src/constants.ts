/**
 * @see https://stackoverflow.com/a/70307091
 * @internal
 */
type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

/**
 * @see https://stackoverflow.com/a/70307091
 *
 * @param - start value
 * @param - end value (non inclusive)
 *
 * @example
 * ```
 * // Creates type of 0, 1, ..., 254, 255
 * export type Byte = Range<0, 256>;
 * ```
 *
 * @internal
 */
export type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

/**
 * Default response timeout in milliseconds.
 */
export const DefaultResponseTimeout = 1000;

/**
 * Reader reset time in milliseconds.
 */
export const ResetTime = 900;

/**
 * Reader protocol packet header/delimiter.
 */
export const PacketHeader = 0xa0;

/**
 * Reader critical temperature.
 */
export const CriticalTemperature = 65;

/**
 * Reader identifier length.
 */
export const IdentifierLength = 12;

/**
 * RSSI value offset.
 */
export const RSSIOffset = -129;

/**
 * ISO 18000-6B UID length.
 */
export const ISO180006BUIDLength = 8;

/**
 * ISO 18000-6C password length.
 */
export const ISO180006CPasswordLength = 4;

/**
 * Tag mask get value.
 */
export const GET_MASKS = 0x20;

/**
 * RS-485 Address values.
 * @enum
 */
export const Address = { PUBLIC: 0xff } as const;
export namespace Address {
  export type PUBLIC = typeof Address.PUBLIC;
}

/**
 * Antenna detector values.
 * @enum
 */
export const AntennaDetector = { DISABLED: 0 } as const;
export namespace AntennaDetector {
  export type DISABLED = typeof AntennaDetector.DISABLED;
}

/**
 * Inventory algorithm repeat values.
 * @enum
 */
export const InventoryAlgorithmRepeat = { MINIMUM: 0xff } as const;
export namespace InventoryAlgorithmRepeat {
  export type MINIMUM = typeof InventoryAlgorithmRepeat.MINIMUM;
}

/**
 * Output power levels.
 * @enum
 */
export const OutputPower = {
  MINIMUM: 0,
  MIN_TEMPORARY: 20,
  MAXIMUM: 33,
} as const;
export namespace OutputPower {
  export type MINIMUM = typeof OutputPower.MINIMUM;
  export type MIN_TEMPORARY = typeof OutputPower.MIN_TEMPORARY;
  export type MAXIMUM = typeof OutputPower.MAXIMUM;
}
export type OutputPower = Range<typeof OutputPower.MINIMUM, 34>; // No way to reference OutputPower.MAXIMUM + 1 here?

/**
 * Frequency table.
 */
export const FrequencyTable: number[] = [];
for (let x = 0; x < 7; ++x) FrequencyTable.push(865 + x * 0.5); // 865 Mhz to 868 Mhz
for (let x = 0; x < 53; ++x) FrequencyTable.push(902 + x * 0.5); // 902 Mhz to 928 Mhz

/**
 * Frequency table indexes.
 */
export type FrequencyTableIndex = Range<0, 60>; // No way to reference FrequencyTable.length here?

/**
 * Serial port baud rate.
 * @enum
 * @internal
 */
export const BaudRate = {
  38400: 3,
  115200: 4,
} as const;
export type BaudRate = keyof typeof BaudRate;

/**
 * Antenna ID.
 */
export enum AntennaID {
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  DISABLED = 0xff,
}

/**
 * Beeper mode.
 */
export enum BeeperMode {
  QUIET,
  INVENTORY,
  TAG,
}

/**
 * Dense reader mode.
 */
export enum DenseReaderMode {
  DISABLED,
  ENABLED,
}

/**
 * EPC match mode.
 */
export enum EPCMatch {
  ENABLED,
  DISABLED,
}

/**
 * Fast ID mode AKA FastTID AKA Monza.
 */
export enum FastID {
  DISABLED = 0x00,
  ENABLED = 0x8d,
}

/**
 * Regulatory mode.
 */
export enum FrequencyRegion {
  FCC = 1,
  ETSI,
  CHN,
  CUSTOM,
}

/**
 * General Purpose Input pins.
 */
export enum GPIOReadable {
  GPIO_1,
  GPIO_2,
}

/**
 * General Purpose Output pins.
 */
export enum GPIOWritable {
  GPIO_3 = 3,
  GPIO_4 = 4,
}

/**
 * General Purpose Input/Output voltage levels.
 */
export enum GPIOLevel {
  LOW,
  HIGH,
}

/**
 * Inventory flag.
 */
export enum InventoriedFlag {
  A,
  B,
}

/**
 * Lockable memory bank fields.
 */
export enum LockMemoryBank {
  RESERVED,
  USER,
  TID,
  EPC,
  ACCESS_PASSWORD,
  KILL_PASSWORD,
}

/**
 * Lock result.
 */
export enum LockResult {
  SUCCESSFULLY_LOCKED = 0x00,
  ALREADY_LOCKED = 0xfe,
  UNLOCKABLE = 0xff,
}

/**
 * Lock state.
 */
export enum LockState {
  UNLOCKED = 0x00,
  LOCKED = 0xfe,
}

/**
 * Lock type.
 */
export enum LockType {
  OPEN,
  LOCK,
  PERMANENT_OPEN,
  PERMANENT_LOCK,
}

/**
 * Memory bank fields.
 */
export enum MemoryBank {
  RESERVED,
  EPC,
  TID,
  USER,
}

/**
 * Phase mode.
 */
export enum PhaseMode {
  OFF,
  ON,
}

/**
 * Inventory select flag.
 *
 * @remarks
 * Reader spec states 0-3, EPC spec says assert or deassert
 */
export enum SelectedFlag {
  SL0,
  SL1,
  SL2,
  SL3,
}

/**
 * Inventory session ID.
 */
export enum SessionID {
  S0,
  S1,
  S2,
  S3,
}

/**
 * Tag mask ID.
 */
export enum MaskID {
  ALL,
  M1,
  M2,
  M3,
  M4,
  M5,
}

/**
 * Tag mask target select value.
 * @internal
 */
enum MaskSelect {
  SL_FLAG = 4,
}

/**
 * Tag mask target.
 */
export const MaskTarget = { ...SessionID, ...MaskSelect };
export type MaskTarget = SessionID | MaskSelect;

/**
 * Tag mask action.
 */
export enum MaskAction {
  A0,
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
}

/**
 * Temperature sign.
 * @internal
 */
export enum TemperatureSign {
  NEGATIVE,
  POSITIVE,
}

/**
 * Command returns error code.
 * @internal
 */
export enum ReturnsError {
  NO,
  YES,
  IF_SINGLE_BYTE_DATA,
  SOMETIMES,
}

/**
 * RF Link profile information.
 * @internal
 */
export const RFLinkProfilesBase = {
  P0: [0xd0, "Tari 25uS, FM0 40KHz"],
  P1: [0xd1, "Tari 25uS, Miller 4 250KHz"],
  P2: [0xd2, "Tari 25uS, Miller 4 300KHz"],
  P3: [0xd3, "Tari 6.25uS, FM0 400KHz"],
} as const;

/**
 * RF Link profiles.
 * @enum
 */
export const RFLinkProfile = Object.fromEntries(
  Object.entries(RFLinkProfilesBase).map(([key, value]) => [key, value[0]])
) as { [Key in keyof typeof RFLinkProfilesBase]: typeof RFLinkProfilesBase[Key][0] };
export type RFLinkProfile = typeof RFLinkProfile[keyof typeof RFLinkProfile];

/**
 * Module function information.
 *
 * @remarks
 * [Code, Description, GPIO_1 Behavior]
 *
 * @internal
 */
export const ModuleFunctionBase = {
  STANDARD: [0x00, "Standard mode", GPIOLevel.HIGH],

  WIEGAND_34_IN_PHASE: [0x02, "Inventory EPC C1G2 tags, last 4 bytes of EPC (in phase)", GPIOLevel.HIGH],
  WIEGAND_26_IN_PHASE: [0x03, "Inventory EPC C1G2 tags, last 3 bytes of EPC (in phase)", GPIOLevel.HIGH],
  FAST_SWITCH: [0x04, "Inventory EPC C1G2 tags (multi antenna)", GPIOLevel.HIGH],
  FAST_SWITCH_DURATION: [0x05, "Inventory EPC C1G2 tags for duration (multi antenna)", GPIOLevel.HIGH],
  WIEGAND_26_REV_PHASE: [0x06, "Inventory EPC C1G2 tags (reverse phase)", GPIOLevel.HIGH],

  PARK: [0x07, "Park, serial port output", GPIOLevel.HIGH],
  BURN_IN: [0x08, "Burn in", GPIOLevel.LOW],

  WIEGAND_26_FAST_SWITCH_IN_PHASE: [0x09, "Inventory EPC C1G2 tags (multi antenna, in phase)", GPIOLevel.HIGH],
  WIEGAND_26_FAST_SWITCH_IN_PHASE_FAST_OUTPUT: [
    0x0a,
    "Inventory EPC C1G2 tags, output 5ms (multi antenna, in phase)",
    GPIOLevel.HIGH,
  ],
  ISO18000_6B_WIEGAND_26_IN_PHASE: [0x0b, "Inventory 18000-6B tags (in phase)", GPIOLevel.HIGH],
  ISO18000_6B_WIEGAND_26_REV_PHASE: [0x0c, "Inventory 18000-6B tags (reverse phase)", GPIOLevel.HIGH],

  FAST_SWITCH_GPIO_LOW: [0x0f, "Inventory EPC C1G2 tags, ? (multi antenna)", GPIOLevel.LOW],
  FAST_SWITCH_BUFFERED: [0x10, "Inventory EPC C1G2 tags, ? (multi antenna)", GPIOLevel.HIGH],
  FAST_SWITCH_IDENTIFIER: [0x11, "Inventory EPC C1G2 tags, report identifier every 5m (multi antenna)", GPIOLevel.HIGH],
  FAST_SWITCH_GPIO3_HIGH_ON_READ: [
    0x12,
    "Inventory EPC C1G2 tags, set GPIO3 HIGH on read (multi antenna)",
    GPIOLevel.HIGH,
  ],
  LOW_POWER_CONSUMPTION: [0x13, "Inventory EPC C1G2 tags (low power mode)", GPIOLevel.LOW],

  FAST_SWITCH_8P: [0x18, "Inventory EPC C1G2 tags (multi antenna, 8 port)", GPIOLevel.HIGH],
} as const;

/**
 * Module function GPIO behaviors.
 * @enum
 */
export const ModuleFunctionGPIO = Object.fromEntries(
  Object.values(ModuleFunctionBase).map(([code, _, level]) => [code, level])
) as {
  [Key in keyof typeof ModuleFunctionBase as typeof ModuleFunctionBase[Key][0]]: typeof ModuleFunctionBase[Key][2];
};

/**
 * Module functions.
 * @enum
 */
export const ModuleFunction = Object.fromEntries(
  Object.entries(ModuleFunctionBase).map(([key, value]) => [key, value[0]])
) as { [Key in keyof typeof ModuleFunctionBase]: typeof ModuleFunctionBase[Key][0] };
export type ModuleFunction = typeof ModuleFunction[keyof typeof ModuleFunction];

/**
 * Command information.
 *
 * @remarks
 * [Code, Description, Returns Error Code]
 *
 * @internal
 */
export const CommandsBase = {
  GET_GPIO_VALUE: [0x60, "Get GPIO1, GPIO2 state", ReturnsError.NO],
  SET_GPIO_VALUE: [0x61, "Set GPIO3, GPIO4 state", ReturnsError.YES],
  SET_ANT_CONNECTION_DETECTOR: [0x62, "Set antenna detector return loss threshold", ReturnsError.YES],
  GET_ANT_CONNECTION_DETECTOR: [0x63, "Get antenna detector return loss threshold", ReturnsError.NO],

  SET_TEMPORARY_OUTPUT_POWER: [0x66, "Set tx power", ReturnsError.YES],
  SET_READER_IDENTIFIER: [0x67, "Set identifier (save to flash)", ReturnsError.YES],
  GET_READER_IDENTIFIER: [0x68, "Get identifier", ReturnsError.NO],
  SET_RF_LINK_PROFILE: [0x69, "Set data encoding profile (save to flash)", ReturnsError.YES],
  GET_RF_LINK_PROFILE: [0x6a, "Get data encoding profile", ReturnsError.SOMETIMES],

  RESET: [0x70, "Reset reader", ReturnsError.YES],
  SET_UART_BAUDRATE: [0x71, "Set baud rate of serial port (save to flash)", ReturnsError.YES],
  GET_FIRMWARE_VERSION: [0x72, "Get firmware version", ReturnsError.NO],
  SET_READER_ADDRESS: [0x73, "Set address (save to flash)", ReturnsError.YES],
  SET_WORK_ANTENNA: [0x74, "Set working antenna port", ReturnsError.YES],
  GET_WORK_ANTENNA: [0x75, "Get working antenna port", ReturnsError.NO],
  SET_OUTPUT_POWER: [0x76, "Set tx power (save to flash)", ReturnsError.YES],
  GET_OUTPUT_POWER: [0x77, "Get tx power", ReturnsError.NO],
  SET_FREQUENCY_REGION: [0x78, "Set frequency band", ReturnsError.YES],
  GET_FREQUENCY_REGION: [0x79, "Get frequency band", ReturnsError.NO],
  SET_BEEPER_MODE: [0x7a, "Set beeper mode (save to flash)", ReturnsError.YES],
  GET_READER_TEMPERATURE: [0x7b, "Get temperature", ReturnsError.IF_SINGLE_BYTE_DATA],
  SET_DRM_MODE: [0x7c, "Set DRM mode", ReturnsError.YES],
  GET_DRM_MODE: [0x7d, "Get DRM mode", ReturnsError.NO],
  GET_RF_PORT_RETURN_LOSS: [0x7e, "Get return loss on working antenna port", ReturnsError.SOMETIMES],

  // ISO 18000-6C (EPC Class 1 Generation 2 AKA EPC C1G2 AKA EPC Gen 2)
  INVENTORY: [0x80, "Inventory EPC C1G2 tags (buffer)", ReturnsError.IF_SINGLE_BYTE_DATA],
  READ: [0x81, "Read EPC C1G2 tags", ReturnsError.IF_SINGLE_BYTE_DATA],
  WRITE: [0x82, "Write EPC C1G2 tags", ReturnsError.IF_SINGLE_BYTE_DATA],
  LOCK: [0x83, "Lock EPC C1G2 tags", ReturnsError.IF_SINGLE_BYTE_DATA],
  KILL: [0x84, "Kill EPC C1G2 tags", ReturnsError.IF_SINGLE_BYTE_DATA],
  SET_ACCESS_EPC_MATCH: [0x85, "Set EPC C1G2 access filter", ReturnsError.YES],
  GET_ACCESS_EPC_MATCH: [0x86, "Get EPC C1G2 access filter", ReturnsError.NO],

  REAL_TIME_INVENTORY: [0x89, "Inventory EPC C1G2 tags (real time)", ReturnsError.IF_SINGLE_BYTE_DATA],
  FAST_SWITCH_ANT_INVENTORY: [
    0x8a,
    "Inventory EPC C1G2 tags (real time, multi antenna)",
    ReturnsError.IF_SINGLE_BYTE_DATA,
  ],
  CUSTOMIZED_SESSION_TARGET_INVENTORY: [
    0x8b,
    "Inventory EPC C1G2 tags (real time, session)",
    ReturnsError.IF_SINGLE_BYTE_DATA,
  ],
  SET_IMPINJ_FAST_TID: [0x8c, "Set Impinj FastID state", ReturnsError.YES],
  SET_AND_SAVE_IMPINJ_FAST_TID: [0x8d, "Set Impinj FastID state (save to flash)", ReturnsError.YES],
  GET_IMPINJ_FAST_TID: [0x8e, "Get Impinj FastID state", ReturnsError.NO],
  GET_ANT_SWITCH_SEQUENCE: [0x8f, "Get antenna switch sequence", ReturnsError.NO],

  GET_INVENTORY_BUFFER: [0x90, "Get buffered EPC C1G2 inventory data", ReturnsError.IF_SINGLE_BYTE_DATA],
  GET_AND_RESET_INVENTORY_BUFFER: [
    0x91,
    "Get and clear buffered EPC C1G2 inventory data",
    ReturnsError.IF_SINGLE_BYTE_DATA,
  ],
  GET_INVENTORY_BUFFER_TAG_COUNT: [0x92, "Get number of buffered EPC C1G2 inventory records", ReturnsError.NO],
  RESET_INVENTORY_BUFFER: [0x93, "Clear buffered EPC C1G2 inventory", ReturnsError.YES],

  WRITE_BLOCK: [0x94, "BlockWrite EPC C1G2 tags", ReturnsError.IF_SINGLE_BYTE_DATA],

  GET_OUTPUT_POWER_8P: [0x97, "Get tx power (8 port)", ReturnsError.NO],
  TAG_MASK: [0x98, "Get/Set tag mask", ReturnsError.SOMETIMES],

  SET_MODULE_FUNCTION: [0xa0, "Set module function", ReturnsError.YES],
  GET_MODULE_FUNCTION: [0xa1, "Get module function", ReturnsError.NO],

  // ISO18000-6B
  ISO18000_6B_INVENTORY: [0xb0, "Inventory 18000-6B tags (real time)", ReturnsError.IF_SINGLE_BYTE_DATA],
  ISO18000_6B_READ: [0xb1, "Read 18000-6B tag", ReturnsError.IF_SINGLE_BYTE_DATA],
  ISO18000_6B_WRITE: [0xb2, "Write 18000-6B tag", ReturnsError.IF_SINGLE_BYTE_DATA],
  ISO18000_6B_LOCK: [0xb3, "Lock 18000-6B tag data byte", ReturnsError.IF_SINGLE_BYTE_DATA],
  ISO18000_6B_QUERY_LOCK: [0xb4, "Query 18000-6B tag data byte lock status", ReturnsError.IF_SINGLE_BYTE_DATA],
} as const;

/**
 * Command returns error code.
 * @enum
 */
export const CommandReturnsError = Object.fromEntries(
  Object.values(CommandsBase).map(([code, _, retErr]) => [code, retErr])
) as { [Key in keyof typeof CommandsBase as typeof CommandsBase[Key][0]]: typeof CommandsBase[Key][2] };

/**
 * Commands.
 * @enum
 */
export const Command = Object.fromEntries(Object.entries(CommandsBase).map(([key, value]) => [key, value[0]])) as {
  [Key in keyof typeof CommandsBase]: typeof CommandsBase[Key][0];
};
export type Command = typeof Command[keyof typeof Command];

/**
 * Command error information.
 *
 * @remarks
 * [Code, Description]
 *
 * @internal
 */
export const CommandErrorBase = {
  SUCCESS: [0x10, "Command succeeded"],
  FAIL: [0x11, "Command failed"],

  MCU_RESET_ERROR: [0x20, "Error resetting CPU"],
  CW_ON_ERROR: [0x21, "Error enabling CW"],
  ANTENNA_MISSING_ERROR: [0x22, "Antenna not connected"],
  WRITE_FLASH_ERROR: [0x23, "Error writing flash"],
  READ_FLASH_ERROR: [0x24, "Error reading flash"],
  SET_OUTPUT_POWER_ERROR: [0x25, "Error setting transmit power"],

  TAG_INVENTORY_ERROR: [0x31, "Error inventorying tag"],
  TAG_READ_ERROR: [0x32, "Error reading tag"],
  TAG_WRITE_ERROR: [0x33, "Error writing tag"],
  TAG_LOCK_ERROR: [0x34, "Error locking tag"],
  TAG_KILL_ERROR: [0x35, "Error killing tag"],
  NO_TAG_ERROR: [0x36, "No operable tag found"],
  INVENTORY_OK_BUT_ACCESS_FAIL: [0x37, "Inventory completed but access failed"],
  BUFFER_IS_EMPTY_ERROR: [0x38, "Buffer is empty"],

  NXP_CUSTOM_COMMAND_FAIL: [0x3c, "NXP custom command failed"],

  ACCESS_OR_PASSWORD_ERROR: [0x40, "Error accessing tag or incorrect password"],
  PARAMETER_INVALID: [0x41, "Invalid parameter"],
  PARAMETER_INVALID_WORDCNT_TOO_LONG: [0x42, "WordCnt too long"],
  PARAMETER_INVALID_MEMBANK_OUT_OF_RANGE: [0x43, "MemBank out of range"],
  PARAMETER_INVALID_LOCK_REGION_OUT_OF_RANGE: [0x44, "Lock region out of range"],
  PARAMETER_INVALID_LOCK_ACTION_OUT_OF_RANGE: [0x45, "LockType out of range"],
  PARAMETER_READER_ADDRESS_INVALID: [0x46, "Invalid reader address"],
  PARAMETER_INVALID_ANTENNA_ID_OUT_OF_RANGE: [0x47, "Antenna ID out of range"],
  PARAMETER_INVALID_OUTPUT_POWER_OUT_OF_RANGE: [0x48, "Transmit power out of range"],
  PARAMETER_INVALID_FREQUENCY_REGION_OUT_OF_RANGE: [0x49, "Frequency region out of range"],
  PARAMETER_INVALID_BAUDRATE_OUT_OF_RANGE: [0x4a, "Baud rate out of range"],
  PARAMETER_BEEPER_MODE_OUT_OF_RANGE: [0x4b, "Beeper mode out of range"],
  PARAMETER_EPC_MATCH_LEN_TOO_LONG: [0x4c, "EPC match too long"],
  PARAMETER_EPC_MATCH_LEN_ERROR: [0x4d, "EPC match length incorrect"],
  PARAMETER_INVALID_EPC_MATCH_MODE: [0x4e, "Invalid EPC match mode"],
  PARAMETER_INVALID_FREQUENCY_RANGE: [0x4f, "Invalid frequency range"],
  FAIL_TO_GET_RN16_FROM_TAG: [0x50, "Error retrieving RN16 from tag"],
  PARAMETER_INVALID_DRM_MODE: [0x51, "Invalid DRM mode"],
  PLL_LOCK_FAIL: [0x52, "Error locking PLL"],
  RF_CHIP_FAIL_TO_RESPONSE: [0x53, "No response from RF chip"],
  FAIL_TO_ACHIEVE_DESIRED_OUTPUT_POWER: [0x54, "Failed to achieve desired transmit power"],
  COPYRIGHT_AUTHENTICATION_FAIL: [0x55, "Failed firmware copyright authentication"],
  SPECTRUM_REGULATION_ERROR: [0x56, "Error setting spectrum regulation"],
  OUTPUT_POWER_TOO_LOW: [0x57, "Transmit power too low"],

  FAIL_TO_GET_RF_PORT_RETURN_LOSS: [0xee, "Failed retrieving RF port return loss"],
} as const;

/**
 * Command errors.
 * @enum
 */
export const CommandErrors = Object.fromEntries(
  Object.entries(CommandErrorBase).map(([key, value]) => [key, value[0]])
) as { [Key in keyof typeof CommandErrorBase]: typeof CommandErrorBase[Key][0] };
export type CommandErrors = typeof CommandErrors[keyof typeof CommandErrors];
