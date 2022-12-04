import type {
  AntennaID,
  Command,
  CommandErrors,
  EPCMatch,
  FrequencyRegion,
  FrequencyTableIndex,
  LockResult,
  LockState,
  MaskAction,
  MaskID,
  MaskTarget,
  MemoryBank,
} from "./constants.js";

interface CommunicationBase {
  /** Antenna port used. */
  antenna: AntennaID;
}

interface TagCommunicationBase extends CommunicationBase {
  /** Frequency table index response received on. */
  frequency: FrequencyTableIndex;
  /** Protocol Control (16 bits). */
  pc: number;
  /** Electronic Product Code (96 - 496 bits). */
  epc: Buffer;
  /** CRC-16 for PC + EPC. */
  crc: number;
}

interface TagWLKBase extends TagCommunicationBase {
  /** Response error code. */
  errorCode: CommandErrors;
}

export type FastSwitchAntenna = [
  /** Antenna port to use. */
  antenna: AntennaID,
  /** Number of times to repeat inventory on this antenna. */
  repeat: number
];

export interface R2KReaderEvents {
  /** Event emitted when an ISO 18000-6C tag is inventoried. */
  tagFound: (tag: InventoriedTag, when: Date) => void;
  /** Event emitted when an ISO 18000-6B tag is inventoried. */
  tag6BFound: (tag: Inventoried6BTag, when: Date) => void;
  /** Event emitted when fast switch inventory attempts to use a disconnected antenna port. */
  antennaMissing: (antenna: AntennaID) => void;
}

export interface ResponseCallback {
  /** Awaited command. */
  command: Command;
  /** Callback to call upon response. */
  callback: (response: ResponseData) => void;
  /** Timeout for awaited command. */
  timeout: NodeJS.Timeout;
}

export interface ResponseData {
  /** Length of reponse (minus packet header and length field). */
  length: number;
  /** Reader RS-485 address. */
  address: number;
  /** Command response is for. */
  command: Command;
  /** Response data. */
  data: Buffer;
  /** Response error code. */
  errorCode: CommandErrors | undefined;
  /** Whether response signals success or not. */
  success: boolean;
}

export interface FrequencyBand {
  /** Regulatory region. */
  region: FrequencyRegion;
  /** Start frequency table index. */
  startFreq: FrequencyTableIndex;
  /** End frequency table index. */
  endFreq: FrequencyTableIndex;
}

export interface CustomFrequencyBand {
  /** Start frequency in kHz. */
  startFreq: number;
  /** Number of frequencies to use. */
  freqQuantity: number;
  /** Spacing between frequencies (divided by 10). */
  freqSpace: number;
}

export interface AntennaSwitchingSequence {
  /** Antennas and number of times to repeat on antennas. */
  antennas: FastSwitchAntenna[];
  /** Rest interval between switching antennas in ms. */
  restInterval: number;
}

export interface AccessEPCMatch {
  /** EPC matching mode. */
  status: EPCMatch;
  /** EPC length. */
  epcLen?: number;
  /** EPC to match. */
  epc?: Buffer;
}

export interface TagMask {
  /** Mask ID. */
  maskID: Exclude<MaskID, MaskID.ALL>;
  /** Mask target. */
  target: MaskTarget;
  /** Mask action. */
  action: MaskAction;
  /** Memory bank to apply mask to. */
  membank: MemoryBank;
  /** Address in memory bank to apply mask to. */
  address: number;
  /** Number of bits in mask to use. */
  bitLength: Exclude<number, 0>;
  /** Tag mask. */
  mask: Buffer;
}

export interface ProtocolControl {
  /** EPC length. */
  epcLength: number;
  /** User-memory indicator. */
  umi: boolean;
  /** XPC_W1 indicator. */
  xi: boolean;
  /** Numbering system indicator */
  t: boolean;
}

export interface InventoryResult extends CommunicationBase {
  /** Read rate (tags per second). */
  readRate: number;
  /** Number of successful tag reads. */
  totalRead: number;
}

export interface BufferedInventoryResult extends InventoryResult {
  /** Number of unique tags inventoried. */
  tagCount: number;
}

export interface Inventory6BResult extends CommunicationBase {
  /** Number of unique tags inventoried. */
  tagCount: number;
}

export interface Read6BResult extends CommunicationBase {
  /** Data read from tag. */
  data: Buffer;
}

export interface Write6BResult extends CommunicationBase {
  /** Bytes written to tag. */
  written: number;
}

export interface Lock6BResult extends CommunicationBase {
  /** Result of attempt to lock byte. */
  status: LockResult;
}

export interface QueryLock6BResult extends CommunicationBase {
  /** Current lock state of byte. */
  status: LockState;
}

export interface InventoriedTag extends TagCommunicationBase {
  /** RSSI for first tag response. */
  rssi: number;
  /** Phase angle. */
  phaseAngle?: number;
}

export interface BufferedInventoriedTag extends InventoriedTag {
  /** Number of times tag was inventoried (maximum 255). */
  count: number;
}

export interface Inventoried6BTag extends CommunicationBase {
  /** Tag UID (8 bytes). */
  uid: Buffer;
}

export interface ReadTag extends TagCommunicationBase {
  /** Data read. */
  data: Buffer;
  /** Number of times tag was read (maximum 255). */
  count: number;
}

export interface WriteTag extends TagWLKBase {
  /** Number of times tag was written (maximum 255). */
  count: number;
}

export interface LockTag extends TagWLKBase {
  /** Number of times tag was locked (maximum 255). */
  count: number;
}

export interface KillTag extends TagWLKBase {
  /** Number of times tag was killed (always 1). */
  count: number;
}
