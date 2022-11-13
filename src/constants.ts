
// https://stackoverflow.com/a/70307091
type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>
type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>

// UHF RFID Reader Serial Protocol V3.7
export const PacketHeader = 0xA0;
export const CriticalTemperature = 65;
export const IdentifierLength = 12;
export const RSSIOffset = -129;


// These types accept a range, but have a few well known values
export type Address = Range<0, 256>;
export const Address: {[key: string]: Address} = {
  PUBLIC: 0xFF,
 } as const;

export type AntennaDetector = Range<0, 256>;
export const AntennaDetector: {[key: string]: AntennaDetector} = {
  DISABLED: 0,
} as const;

export type InventoryRepeat = Range<0, 256>;
export const InventoryRepeat: {[key: string]: InventoryRepeat} = {
  MINIMUM: 0xFF,
} as const;

export type OutputPower = Range<0, 34>;
export const OutputPower: {[key: string]: OutputPower} = {
  MIN          : 0,
  MIN_TEMPORARY: 20,
  MAX          : 33,
} as const;


// These types have only a few acceptable values
export const FrequencyTable: number[] = [];
for (let x = 0; x < 7; ++x)  FrequencyTable.push(865 + x*0.5); // 865 Mhz to 868 Mhz
for (let x = 0; x < 53; ++x) FrequencyTable.push(902 + x*0.5); // 902 Mhz to 928 Mhz

export enum AntennaID {
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  DISABLED = 0xFF,
};

export enum BaudRate {
  BD_38400  = 3,
  BD_115200 = 4,
};

export enum BeeperMode {
  QUIET,
  INVENTORY,
  TAG,
};

export enum EPCMatch {
  ENABLED,
  DISABLED,
};

export enum FastID { // AKA FastTID AKA Monza
  DISABLED = 0x00,
  ENABLED  = 0x8D,
};

export enum FrequencyRegion {
  FCC    = 1,
  ETSI   = 2,
  CHN    = 3,
  CUSTOM = 4,
};

export enum GPIO {
  GPIO_3 = 3,
  GPIO_4 = 4,
};

export enum GPIOState  {
  LOW,
  HIGH,
};

export enum InventoriedFlag {
  A,
  B,
};

export enum LockMemoryBank {
  USER            = 1,
  TID             = 2,
  EPC             = 3,
  ACCESS_PASSWORD = 4,
  KILL_PASSWORD   = 5,
};

export enum LockResult {
  SUCCESSFULLY_LOCKED = 0x00,
  ALREADY_LOCKED      = 0xFE,
  UNLOCKABLE          = 0xFF,
};

export enum LockState {
  UNLOCKED = 0x00,
  LOCKED   = 0xFE,
};

export enum LockType {
  OPEN,
  LOCK,
  PERMANENT_OPEN,
  PERMANENT_LOCK,
};

export enum MemoryBank {
  EPC  = 1,
  TID  = 2,
  USER = 3,
};

export enum PhaseValue {
  OFF,
  ON,
};

export enum SelectedFlag { // Reader spec states 0-3, EPC spec says assert or deassert
  SL0,
  SL1,
  SL2,
  SL3,
 };
 
 export enum SessionID {
  S0,
  S1,
  S2,
  S3,
};

export enum TemperatureSign {
  NEGATIVE,
  POSITIVE,
};


// These types have a value and a description
const RFLinkProfilesBase = {
  P0: [0xD0, 'Tari 25uS, FM0 40KHz'],
  P1: [0xD1, 'Tari 25uS, Miller 4 250KHz'],
  P2: [0xD2, 'Tari 25uS, Miller 4 300KHz'],
  P3: [0xD3, 'Tari 6.25uS, FM0 400KHz'],
} as const;

export const RFLinkProfileDescription = Object.fromEntries(Object.values(RFLinkProfilesBase));
export const RFLinkProfiles = Object.fromEntries(Object.entries(RFLinkProfilesBase).map(([key, value]) => [key, value[0]]));
export type RFLinkProfiles = typeof RFLinkProfiles[keyof typeof RFLinkProfiles];

const CommandsBase = {
  GET_GPIO_VALUE             : [0x60, 'Get GPIO1, GPIO2 state'],
  SET_GPIO_VALUE             : [0x61, 'Set GPIO3, GPIO4 state'],
  SET_ANT_CONNECTION_DETECTOR: [0x62, 'Set antenna detector return loss threshold'],
  GET_ANT_CONNECTION_DETECTOR: [0x63, 'Get antenna detector return loss threshold'],
  SET_TEMPORARY_OUTPUT_POWER : [0x66, 'Set tx power'],
  SET_READER_IDENTIFIER      : [0x67, 'Set identifier (save to flash)'],
  GET_READER_IDENTIFIER      : [0x68, 'Get identifier'],
  SET_RF_LINK_PROFILE        : [0x69, 'Set data encoding profile (save to flash)'],
  GET_RF_LINK_PROFILE        : [0x6A, 'Get data encoding profile'],

  RESET                      : [0x70, 'Reset reader'],
  SET_UART_BAUDRATE          : [0x71, 'Set baud rate of serial port (save to flash)'],
  GET_FIRMWARE_VERSION       : [0x72, 'Get firmware version'],
  SET_READER_ADDRESS         : [0x73, 'Set address (save to flash)'],
  SET_WORK_ANTENNA           : [0x74, 'Set working antenna port'],
  GET_WORK_ANTENNA           : [0x75, 'Get working antenna port'],
  SET_OUTPUT_POWER           : [0x76, 'Set tx power (save to flash)'],
  GET_OUTPUT_POWER           : [0x77, 'Get tx power'],
  SET_FREQUENCY_REGION       : [0x78, 'Set frequency band'],
  GET_FREQUENCY_REGION       : [0x79, 'Get frequency band'],
  SET_BEEPER_MODE            : [0x7A, 'Set beeper mode (save to flash)'],
  GET_READER_TEMPERATURE     : [0x7B, 'Get temperature'],
  SET_DRM_MODE               : [0x7C, 'Set DRM mode'], // ??
  GET_DRM_MODE               : [0x7D, 'Get DRM mode'], // ??
  GET_RF_PORT_RETURN_LOSS    : [0x7E, 'Get return loss on working antenna port'],

  // ISO 18000-6C (EPC Class 1 Generation 2 AKA EPC C1G2 AKA EPC Gen 2)
  INVENTORY                  : [0x80, 'Inventory EPC C1G2 tags (buffer)'],
  READ                       : [0x81, 'Read EPC C1G2 tags'],
  WRITE                      : [0x82, 'Write EPC C1G2 tags'],
  LOCK                       : [0x83, 'Lock EPC C1G2 tags'],
  KILL                       : [0x84, 'Kill EPC C1G2 tags'],
  SET_ACCESS_EPC_MATCH       : [0x85, 'Set EPC C1G2 access filter'],
  GET_ACCESS_EPC_MATCH       : [0x86, 'Get EPC C1G2 access filter'],

  REAL_TIME_INVENTORY                : [0x89, 'Inventory EPC C1G2 tags (real time)'],
  FAST_SWITCH_ANT_INVENTORY          : [0x8A, 'Inventory EPC C1G2 tags (real time, multi antenna)'],
  CUSTOMIZED_SESSION_TARGET_INVENTORY: [0x8B, 'Inventory EPC C1G2 tags (real time, session)'],
  SET_IMPINJ_FAST_TID                : [0x8C, 'Set Impinj FastID state'],
  SET_AND_SAVE_IMPINJ_FAST_TID       : [0x8D, 'Set Impinj FastID state (save to flash)'],
  GET_IMPINJ_FAST_TID                : [0x8E, 'Get Impinj FastID state'],
  
  GET_INVENTORY_BUFFER               : [0x90, 'Get buffered EPC C1G2 inventory data'],
  GET_AND_RESET_INVENTORY_BUFFER     : [0x91, 'Get and clear buffered EPC C1G2 inventory data'],
  GET_INVENTORY_BUFFER_TAG_COUNT     : [0x92, 'Get number of buffered EPC C1G2 inventory records'],
  RESET_INVENTORY_BUFFER             : [0x93, 'Clear buffered EPC C1G2 inventory'],

  WRITE_BLOCK                        : [0x94, 'BlockWrite EPC C1G2 tags'],

  GET_OUTPUT_POWER_8P                : [0x97, 'Get tx power (8 port)'], // ??
  TAG_MASK                           : [0x98, 'Get/Set tag mask'], // ??

  // ISO18000-6B
  ISO18000_6B_INVENTORY              : [0xB0, 'Inventory 18000-6B tags (real time)'],
  ISO18000_6B_READ                   : [0xB1, 'Read 18000-6B tag'],
  ISO18000_6B_WRITE                  : [0xB2, 'Write 18000-6B tag'],
  ISO18000_6B_LOCK                   : [0xB3, 'Lock 18000-6B tag data byte'],
  ISO18000_6B_QUERY_LOCK             : [0xB4, 'Query 18000-6B tag data byte lock status'],
} as const;

export const CommandDescription = Object.fromEntries(Object.values(CommandsBase));
export const Command = Object.fromEntries(Object.entries(CommandsBase).map(([key, value]) => [key, value[0]]));
export type Command = typeof Command[keyof typeof Command];

const ErrorsBase = {
  SUCCESS                     : [0x10, "Command succeeded"],
  FAIL                        : [0x11, "Command failed"],

  MCU_RESET_ERROR             : [0x20, "Error resetting CPU"],
  CW_ON_ERROR                 : [0x21, "Error enabling CW"],
  ANTENNA_MISSING_ERROR       : [0x22, "Antenna not found"],
  WRITE_FLASH_ERROR           : [0x23, "Error writing flash"],
  READ_FLASH_ERROR            : [0x24, "Error reading flash"],
  SET_OUTPUT_POWER_ERROR      : [0x25, "Error setting transmit power"],

  TAG_INVENTORY_ERROR         : [0x31, "Error inventorying tag"],
  TAG_READ_ERROR              : [0x32, "Error reading tag"],
  TAG_WRITE_ERROR             : [0x33, "Error writing tag"],
  TAG_LOCK_ERROR              : [0x34, "Error locking tag"],
  TAG_KILL_ERROR              : [0x35, "Error killing tag"],
  NO_TAG_ERROR                : [0x36, "No operable tag found"],
  INVENTORY_OK_BUT_ACCESS_FAIL: [0x37, "Inventory completed but access failed"],
  BUFFER_IS_EMPTY_ERROR       : [0x38, "Buffer is empty"],

  NXP_CUSTOM_COMMAND_FAIL     : [0x3C, "NXP custom command failed"],

  ACCESS_OR_PASSWORD_ERROR                       : [0x40, "Error accessing tag or incorrect password"],
  PARAMETER_INVALID                              : [0x41, "Invalid parameter"],
  PARAMETER_INVALID_WORDCNT_TOO_LONG             : [0x42, "WordCnt too long"],
  PARAMETER_INVALID_MEMBANK_OUT_OF_RANGE         : [0x43, "MemBank out of range"],
  PARAMETER_INVALID_LOCK_REGION_OUT_OF_RANGE     : [0x44, "Lock region out of range"],
  PARAMETER_INVALID_LOCK_ACTION_OUT_OF_RANGE     : [0x45, "LockType out of range"],
  PARAMETER_READER_ADDRESS_INVALID               : [0x46, "Invalid reader address"],
  PARAMETER_INVALID_ANTENNA_ID_OUT_OF_RANGE      : [0x47, "Antenna ID out of range"],
  PARAMETER_INVALID_OUTPUT_POWER_OUT_OF_RANGE    : [0x48, "Transmit power out of range"],
  PARAMETER_INVALID_FREQUENCY_REGION_OUT_OF_RANGE: [0x49, "Frequency region out of range"],
  PARAMETER_INVALID_BAUDRATE_OUT_OF_RANGE        : [0x4A, "Baud rate out of range"],
  PARAMETER_BEEPER_MODE_OUT_OF_RANGE             : [0x4B, "Beeper mode out of range"],
  PARAMETER_EPC_MATCH_LEN_TOO_LONG               : [0x4C, "EPC match too long"],
  PARAMETER_EPC_MATCH_LEN_ERROR                  : [0x4D, "EPC match length incorrect"],
  PARAMETER_INVALID_EPC_MATCH_MODE               : [0x4E, "Invalid EPC match mode"],
  PARAMETER_INVALID_FREQUENCY_RANGE              : [0x4F, "Invalid frequency range"],
  FAIL_TO_GET_RN16_FROM_TAG                      : [0x50, "Error retrieving RN16 from tag"],
  PARAMETER_INVALID_DRM_MODE                     : [0x51, "Invalid DRM mode"],
  PLL_LOCK_FAIL                                  : [0x52, "Error locking PLL"],
  RF_CHIP_FAIL_TO_RESPONSE                       : [0x53, "No response from RF chip"],
  FAIL_TO_ACHIEVE_DESIRED_OUTPUT_POWER           : [0x54, "Failed to achieve desired transmit power"],
  COPYRIGHT_AUTHENTICATION_FAIL                  : [0x55, "Failed firmware copyright authentication"],
  SPECTRUM_REGULATION_ERROR                      : [0x56, "Error setting spectrum regulation"],
  OUTPUT_POWER_TOO_LOW                           : [0x57, "Transmit power too low"],

  FAIL_TO_GET_RF_PORT_RETURN_LOSS                : [0xEE, "Failed retrieving RF port return loss"],
} as const;

export const ErrorDescription = Object.fromEntries(Object.values(ErrorsBase));
export const Errors = Object.fromEntries(Object.entries(ErrorsBase).map(([key, value]) => [key, value[0]]));
export type Errors = typeof Errors[keyof typeof Errors];