// Impinj R2000 ENUMS.
// Ported from https://github.com/hex-in/pyImpinj

import { SerialPort } from 'serialport'
import assert from 'assert';

import {Commands, Command, FastSwitchInventory, Region} from './enums';
import { READER_ANTENNA, TAG_MEMORY_BANK } from './constant';


interface MessageHandlerMap {
  name: keyof Protocol;
  command: Command;
}

function register(command: Command) {
  return function(target: Protocol, propertyKey: string, descriptor: PropertyDescriptor) {
    target.registerHandler(command, propertyKey as any);
  }
}

const SessionsDict = {
  S0: 0,
  S1: 1,
  S2: 2,
  S3: 3,
};

const MemoryBank = {
  USER: 1,
  TID: 2,
  EPC: 3,
  ACCESS_PASSWORD: 4,
  KILL_PASSWORD: 5,
};
const LockType = {
  OPEN: 0,
  LOCK: 1,
  OPEN_FOREVER: 2,
  LOCK_FOREVER: 3,
};

interface FastSwitchInventoryParams {
  A: FastSwitchInventory;
  Aloop: number;
  B: FastSwitchInventory;
  Bloop: number;
  C: FastSwitchInventory;
  Cloop: number;
  D: FastSwitchInventory;
  Dloop: number;
  Interval: number;
  Repeat: number;
};
const DefaultFSInventory: FastSwitchInventoryParams = {
  A: FastSwitchInventory.ANTENNA1,
  Aloop: 1,
  B: FastSwitchInventory.DISABLED,
  Bloop: 1,
  C: FastSwitchInventory.DISABLED,
  Cloop: 1,
  D: FastSwitchInventory.DISABLED,
  Dloop: 1,
  Interval: 0, Repeat: 1,
};

function ord(str: string) { return str.charCodeAt(0); }

export class Protocol {
  __head: number = 0xA0; // TODO: Figure out what this should be
  __address = 0xA0;
  #address = 0xFF;

  commandMap: {[command: number]: keyof Protocol} = {};

  constructor(protected serial: SerialPort) {

  }

  registerHandler(command: Command, handler: keyof Protocol) {
    this.commandMap[command] = handler;
  }

  handleMessage(cmd: Command, ...args: any[]) {
    const fnName = this.commandMap[cmd];
    if (!fnName) { throw new Error(`Invalid command: ${cmd.toString(16)}`); }

    const data: number[] = (<any>this[fnName])?.(...args) ?? [];

    const message: number[] = [
      this.__head,
      data.length + 3,
      this.__address,
      cmd,
    ];
    // Add LRC checksum
    message.push(checksum(message));

    if (cmd === Commands.SET_READER_ADDRESS) {
      this.__address = data[0];
    }

    if (this.serial) {
      try {
        this.serial.write(message);
      } catch (err) {
        console.warn("Errro writing to serial port:", err);
      }
    } else {
      console.warn("Attempted to write but no serial connection is present");
    }
  }

  @register(Commands.RESET)
  reset() {
    return [];
  }

  @register( Commands.SET_UART_BAUDRATE )
  /**
   * 38400bps or 115200bps.
   */
  baudrate( value = 115200 ) {
    if (value === 115200) return 4
    else return 3;
  }

  @register( Commands.SET_READER_ADDRESS )
  address( addr=0 ) {
    assert ( 0 <= addr && addr <= 254 );
    return [ addr ];
  }

  @register( Commands.GET_FIRMWARE_VERSION )
  version() {
      return [];
  }

  @register( Commands.SET_WORK_ANTENNA )
  // """ Set reader work antenna.
  //     @param      antenna(int) : 0 ~ 3
  // """
  set_work_antenna( antenna = READER_ANTENNA.ANTENNA1 ) {
      assert ( 0 <= antenna && antenna <= 3 )
      return [ antenna ]
  }

  @register( Commands.GET_WORK_ANTENNA )
  get_work_antenna() {
      return [];
  }

  @register( Commands.SET_RF_POWER )
  set_rf_power( ant1=0x00, ant2=0x00, ant3=0x00, ant4=0x00 ) {
      assert (( 0 <= ant1 && ant1 <= 33 ) && ( 0 <= ant2 && ant2 <= 33 ) && ( 0 <= ant3 && ant3 <= 33 ) && ( 0 <= ant4 && ant4 <= 33 ));
      return [ ant1, ant2, ant3, ant4 ];
  }

  @register( Commands.GET_RF_POWER )
  get_rf_power() {
      return [];
  }

  @register( Commands.SET_TEMPORARY_OUTPUT_POWER )
  fast_power( value = 22 ) {
      assert ( 22 <= value && value <= 33 );
      return [ value ];
  }

  @register( Commands.SET_BEEPER_MODE )
  beeper( mode = 0 ) {
      assert ( 0 <= mode && mode <= 2 )
      return [ mode ]
  }

  @register( Commands.GET_ANT_CONNECTION_DETECTOR )
  get_ant_connection_detector() {
      return [];
  }

  @register( Commands.SET_ANT_CONNECTION_DETECTOR )
  set_ant_connection_detector( loss=0 ) {
    // """
    //     @param  loss = 0 # Disabled detector.
    //             loss (Unit:dB) 
    //             (The higher the value, the higher the impedance matching requirements for the port)
    // """
    return [ loss ]
  }

  @register( Commands.SET_READER_IDENTIFIER )
  set_reader_identifier( sn = '0123456789AB' ) {
    const data = sn.split('').map(s => s.charCodeAt(0));
    while (data.length < 12) {
      data.push(0xff);
    }
    return data;
  }

  @register( Commands.GET_READER_IDENTIFIER )
  get_reader_identifier() {
    return [];
  }

  @register( Commands.INVENTORY )
  inventory( repeat=0xFF ) {
    return [ repeat ]
  }

  @register( Commands.GET_INVENTORY_BUFFER )
  get_inventory_buffer() {
    return [];
  }

  @register( Commands.GET_INVENTORY_BUFFER_TAG_COUNT )
  get_inventory_buffer_tag_count() {
    return [];
  }
  
  @register( Commands.GET_AND_RESET_INVENTORY_BUFFER )
  get_and_reset_inventory_buffer() {
    return [];
  }

  @register( Commands.RESET_INVENTORY_BUFFER )  
  reset_inventory_buffer() {
    return [];
  }

  @register( Commands.REAL_TIME_INVENTORY )
  rt_inventory( repeat=0xFF ) {
    return [ repeat ]
  }

  @register( Commands.CUSTOMIZED_SESSION_TARGET_INVENTORY )
  session_inventory( session: keyof typeof SessionsDict = 'S1', target='A', repeat=1 ) {
    return [
      SessionsDict[session] || 1,
      target === 'B' ? 1 : 0,
      repeat
    ];
  }

  @register( Commands.FAST_SWITCH_ANT_INVENTORY )
  fast_switch_ant_inventory( {A, Aloop, B, Bloop, C, Cloop, D, Dloop, Interval, Repeat}: FastSwitchInventoryParams = DefaultFSInventory) {
    return [
      A || FastSwitchInventory.DISABLED, 
      Aloop || 1,
      B || FastSwitchInventory.DISABLED, 
      Bloop || 1,
      C || FastSwitchInventory.DISABLED, 
      Cloop || 1,
      D || FastSwitchInventory.DISABLED, 
      Dloop || 1,
      Interval || 5,
      Repeat || 1,
    ];
  }

  gpio( port: number, level = false ) {
    // """
    //     ONLY [R] : GPIO1 and GPIO2
    //     ONLY [W] : GPIO3 and GPIO4

    //     e.g:
    //         R2000 = ImpinjR2KProtocols( )
    //         print( R2000.gpio( 1 ) )
    // """
    assert ( 1 <= port && port <= 4 )
    // if (3 <= port <= 4) {
    //     ret = ImpinjR2KProtocols.register( Commands.SET_GPIO_VALUE )( lambda x, y : y )( [ port, 0x01 if level else 0x00 ] )
    // else:
    //     ret = ImpinjR2KProtocols.register( Commands.GET_GPIO_VALUE )( lambda x, y : y )( [  ] )
    // return ret
  }

  @register( Commands.GET_READER_TEMPERATURE )
  temperature() {
    return [];
  }

  @register( Commands.READ )
  read( bank='EPC', addr=0, size=2, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      TAG_MEMORY_BANK[bank as 'EPC'] || 1,
      addr,
      size,
      ...password,
    ];
    return body;
  }

  @register( Commands.WRITE )
  write( data: number[], bank='EPC', addr=0, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      ...password,
      TAG_MEMORY_BANK[bank as 'EPC'] || 1,
      (bank === 'EPC' && addr === 0) ? 2 : addr,
      Math.floor(data.length / 2),
      ...data,
    ];
    return body;
  }

  // TODO: Should this really be the same as write_block?
  @register( Commands.WRITE_BLOCK )
  write_block( data: number[], bank='EPC', addr=0, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      ...password,
      TAG_MEMORY_BANK[bank as 'EPC'] || 1,
      (bank === 'EPC' && addr === 0) ? 2 : addr,
      Math.floor(data.length / 2),
      ...data,
    ];
    return body;
  }

  @register( Commands.LOCK )
  lock( bank='EPC', lock_type='OPEN', password=[ 0, 0, 0, 0 ] ) {
    // """
    //     @param
    //         bank      = [ 'USER', 'TID', 'EPC', 'ACCESS_PASSWORD', 'KILL_PASSWORD' ]
    //         lock_type = [ 'OPEN', 'LOCK', 'OPEN_FOREVER', 'LOCK_FOREVER' ]
    // """
    assert ( Array.isArray(password) );
    
    const body = [
      ...password,
      MemoryBank[bank as 'EPC'] || 1,
      LockType[lock_type as 'OPEN'] || 1,
    ];
    return body;
  }

  @register( Commands.KILL )
  kill( password=[ 0, 0, 0, 0 ] ) {
    assert ( Array.isArray(password) );
    return password;
  }

  @register( Commands.SET_ACCESS_EPC_MATCH )
  set_access_epc_match( mode: 0 | 1, epc: number[] ) {
    assert( mode === 0 || mode === 1 )
    const body = [
      mode,
      epc.length,
      ...epc, 
    ];
    return body;
  }

  @register( Commands.GET_ACCESS_EPC_MATCH )
  get_access_epc_match() {
    return [];
  }

  @register( Commands.GET_RF_PORT_RETURN_LOSS )
  get_rf_port_return_loss( param: number ) {
    return [ param ]
  }

  @register( Commands.SET_FREQUENCY_REGION )
  set_frequency_region( region: number, start: number, stop: number ) {
    return [ region, start, stop ]
  }

  @register( Commands.GET_FREQUENCY_REGION )
  get_frequency_region() {
    return [];
  }

  @register( Commands.SET_FREQUENCY_REGION )
  set_frequency_region_user( start: number, space: number, quantity: number ) {
    // """
    //     start : e.g. 915000KHz --> 0D F6 38 (unit KHz)
    //     space : space*10 (unit KHz)
    //     quantity : must be above 0
    // """
    assert( quantity > 0 )
    const body = [
      Region.USER,
      space*10,
      quantity,
      ( ( start & 0x00FF0000 ) >> 16 ) & 0x000000FF,
      ( ( start & 0x0000FF00 ) >>  8 ) & 0x000000FF,
      ( ( start & 0x000000FF ) >>  0 ) & 0x000000FF,
    ];
    return body;
  }

  @register( Commands.SET_RF_LINK_PROFILE )
  set_rf_link_profile( profile_id: number ) {
    return [ profile_id ];
  }

  @register( Commands.GET_RF_LINK_PROFILE )
  get_rf_link_profile() {
    return [];
  }

  @register( Commands.ISO18000_6B_INVENTORY )
  iso1800_6b_inventory() {
    // """ ISO 18000 - 6B """
    return [];
  }
    
};
function checksum(message: number[]): number {
  throw new Error('Function not implemented.');
}

