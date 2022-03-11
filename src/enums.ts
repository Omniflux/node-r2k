// Impinj R2000 ENUMS.
// Ported from https://github.com/hex-in/pyImpinj

export const FastSwitchInventory = <const>{
  ANTENNA1: 0,
  ANTENNA2: 1,
  ANTENNA3: 2,
  ANTENNA4: 3,
  DISABLED: 0xFF,
};
export type FastSwitchInventory = typeof FastSwitchInventory[keyof typeof FastSwitchInventory];

export const Commands = <const>{
  GET_GPIO_VALUE              : 0x60,
  SET_GPIO_VALUE              : 0x61,
  SET_ANT_CONNECTION_DETECTOR : 0x62,
  GET_ANT_CONNECTION_DETECTOR : 0x63,
  SET_TEMPORARY_OUTPUT_POWER  : 0x66,
  SET_READER_IDENTIFIER       : 0x67,
  GET_READER_IDENTIFIER       : 0x68,
  SET_RF_LINK_PROFILE         : 0x69,
  GET_RF_LINK_PROFILE         : 0x6A,

  RESET                       : 0x70,
  SET_UART_BAUDRATE           : 0x71,
  GET_FIRMWARE_VERSION        : 0x72,
  SET_READER_ADDRESS          : 0x73,
  SET_WORK_ANTENNA            : 0x74,
  GET_WORK_ANTENNA            : 0x75,
  SET_RF_POWER                : 0x76,
  GET_RF_POWER                : 0x77,
  SET_FREQUENCY_REGION        : 0x78,
  GET_FREQUENCY_REGION        : 0x79,
  SET_BEEPER_MODE             : 0x7A,
  GET_READER_TEMPERATURE      : 0x7B,
  GET_RF_PORT_RETURN_LOSS     : 0x7E,

  // 18000-6C
  INVENTORY                   : 0x80,
  READ                        : 0x81,
  WRITE                       : 0x82,
  LOCK                        : 0x83,
  KILL                        : 0x84,
  SET_ACCESS_EPC_MATCH        : 0x85,
  GET_ACCESS_EPC_MATCH        : 0x86,

  REAL_TIME_INVENTORY         : 0x89,
  FAST_SWITCH_ANT_INVENTORY   : 0x8A,
  CUSTOMIZED_SESSION_TARGET_INVENTORY: 0x8B,
  SET_IMPINJ_FAST_TID         : 0x8C,
  SET_AND_SAVE_IMPINJ_FAST_TID: 0x8D,
  GET_IMPINJ_FAST_TID         : 0x8E,
  
  // ISO18000-6B
  ISO18000_6B_INVENTORY       : 0xB0,
  ISO18000_6B_READ            : 0xB1,
  ISO18000_6B_WRITE           : 0xB2,
  ISO18000_6B_LOCK            : 0xB3,
  ISO18000_6B_QUERY_LOCK      : 0xB4,

  GET_INVENTORY_BUFFER            : 0x90,
  GET_AND_RESET_INVENTORY_BUFFER  : 0x91,
  GET_INVENTORY_BUFFER_TAG_COUNT  : 0x92,
  RESET_INVENTORY_BUFFER          : 0x93,

  WRITE_BLOCK                     : 0x94,
};
export type Command = typeof Commands[keyof typeof Commands];

export const GlobalErrors = <const>{
  SUCCESS                     : 0x10,
  FAIL                        : 0x11,

  MCU_RESET_ERROR             : 0x20,
  CW_ON_ERROR                 : 0x21,
  ANTENNA_MISSING_ERROR       : 0x22,
  WRITE_FLASH_ERROR           : 0x23,
  READ_FLASH_ERROR            : 0x24,
  SET_OUTPUT_POWER_ERROR      : 0x25,

  TAG_INVENTORY_ERROR         : 0x31,
  TAG_READ_ERROR              : 0x32,
  TAG_WRITE_ERROR             : 0x33,
  TAG_LOCK_ERROR              : 0x34,
  TAG_KILL_ERROR              : 0x35,
  NO_TAG_ERROR                : 0x36,
  INVENTORY_OK_BUT_ACCESS_FAIL: 0x37,
  BUFFER_IS_EMPTY_ERROR       : 0x38,
  NXP_CUSTOM_COMMAND_FAIL     : 0x3C,

  ACCESS_OR_PASSWORD_ERROR                         : 0x40,
  PARAMETER_INVALID                                : 0x41,
  PARAMETER_INVALID_WORDCNT_TOO_LONG               : 0x42,
  PARAMETER_INVALID_MEMBANK_OUT_OF_RANGE           : 0x43,
  PARAMETER_INVALID_LOCK_REGION_OUT_OF_RANGE       : 0x44,
  PARAMETER_INVALID_LOCK_ACTION_OUT_OF_RANGE       : 0x45,
  PARAMETER_READER_ADDRESS_INVALID                 : 0x46,
  PARAMETER_INVALID_ANTENNA_ID_OUT_OF_RANGE        : 0x47,
  PARAMETER_INVALID_OUTPUT_POWER_OUT_OF_RANGE      : 0x48,
  PARAMETER_INVALID_FREQUENCY_REGION_OUT_OF_RANGE  : 0x49,
  PARAMETER_INVALID_BAUDRATE_OUT_OF_RANGE          : 0x4A,
  PARAMETER_BEEPER_MODE_OUT_OF_RANGE               : 0x4B,
  PARAMETER_EPC_MATCH_LEN_TOO_LONG                 : 0x4C,
  PARAMETER_EPC_MATCH_LEN_ERROR                    : 0x4D,
  PARAMETER_INVALID_EPC_MATCH_MODE                 : 0x4E,
  PARAMETER_INVALID_FREQUENCY_RANGE                : 0x4F,

  FAIL_TO_GET_RN16_FROM_TAG                        : 0x50,
  PARAMETER_INVALID_DRM_MODE                       : 0x51,
  PLL_LOCK_FAIL                                    : 0x52,
  RF_CHIP_FAIL_TO_RESPONSE                         : 0x53,
  FAIL_TO_ACHIEVE_DESIRED_OUTPUT_POWER             : 0x54,
  COPYRIGHT_AUTHENTICATION_FAIL                    : 0x55,
  SPECTRUM_REGULATION_ERROR                        : 0x56,
  OUTPUT_POWER_TOO_LOW                             : 0x57,
  FAIL_TO_GET_RF_PORT_RETURN_LOSS                  : 0xEE,
}

export function errToString( error_code: number ) {
  if (error_code == GlobalErrors.SUCCESS) return 'SUCCESS';
  else if (error_code == GlobalErrors.MCU_RESET_ERROR) {
    return 'MCU reset error.'
  } else if (error_code == GlobalErrors.WRITE_FLASH_ERROR) {
    return 'Write flash error.';
  }
  
  /// 0x2*
  else if (error_code == GlobalErrors.ANTENNA_MISSING_ERROR) {
    return 'Antenna miss error.';
  }
  else if (error_code == GlobalErrors.SET_OUTPUT_POWER_ERROR) {
    return 'Set output power error.';
  }

  /// 0x3*
  else if (error_code == GlobalErrors.TAG_INVENTORY_ERROR) {
    return 'Tag inventory error';
  }
  else if (error_code == GlobalErrors.TAG_READ_ERROR) {
    return 'Tag read error';
  }
  else if (error_code == GlobalErrors.TAG_WRITE_ERROR) {
    return 'Tag write error'    ;
  }
  else if (error_code == GlobalErrors.TAG_LOCK_ERROR) {
    return 'Tag lock error';
  }
  else if (error_code == GlobalErrors.TAG_KILL_ERROR) {
    return 'Tag kill error';
  }
  else if (error_code == GlobalErrors.NO_TAG_ERROR) {
    return 'No tag error';
  }
  else if (error_code == GlobalErrors.INVENTORY_OK_BUT_ACCESS_FAIL) {
    return 'Inventory is ok, but access failed.';
  }
  else if (error_code == GlobalErrors.BUFFER_IS_EMPTY_ERROR) {
    return 'Buffer is empty.';
  }
  else if (error_code == GlobalErrors.NXP_CUSTOM_COMMAND_FAIL) {
    return 'NXP command failed.';
  }

  else return `FAILED? 0x${error_code.toString(16)}`;
}

export const MemoryBank = {
  RESERVED : 0,
  EPC      : 1,
  TID      : 2,
  USER     : 3,
};

export const Region = {
  FCC  : 1,
  ETSI : 2,
  CHN  : 3,
  USER : 4,
};

export const ImpinjR2KRFLinkProfile = {
  PROFILE0: 0xD0, // Tari 25uS,FM0 40KHz
  PROFILE1: 0xD1, // Tari 25uS,Miller 4 250KHz ( Default )
  PROFILE2: 0xD2, // Tari 25uS,Miller 4 300KHz
  PROFILE3: 0xD3, // Tari 6.25uS,FM0 400KHz
};
