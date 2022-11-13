// Impinj R2000 ENUMS.
// Ported from https://github.com/hex-in/pyImpinj

import { SerialPort } from 'serialport'
import assert from 'assert';

import {
  Address,
  AntennaDetector,
  AntennaID,
  BaudRate,
  BeeperMode,
  Command,
  EPCMatch,
  FrequencyRegion,
  IdentifierLength,
  InventoriedFlag,
  InventoryRepeat,
  LockMemoryBank,
  LockType,
  MemoryBank,
  OutputPower,
  PacketHeader,
  SessionID
} from './constants';


interface MessageHandlerMap {
  name: keyof Protocol;
  command: Command;
}

function register(command: Command) {
  return function(target: Protocol, propertyKey: string, descriptor: PropertyDescriptor) {
    target.registerHandler(command, propertyKey as any);
  }
}

interface FastSwitchInventoryParams {
  A: AntennaID;
  Aloop: number;
  B: AntennaID;
  Bloop: number;
  C: AntennaID;
  Cloop: number;
  D: AntennaID;
  Dloop: number;
  Interval: number;
  Repeat: number;
};
const DefaultFSInventory: FastSwitchInventoryParams = {
  A: AntennaID.A1,
  Aloop: 1,
  B: AntennaID.DISABLED,
  Bloop: 1,
  C: AntennaID.DISABLED,
  Cloop: 1,
  D: AntennaID.DISABLED,
  Dloop: 1,
  Interval: 0, Repeat: 1,
};

function ord(str: string) { return str.charCodeAt(0); }

export class Protocol {
  __address = 0xA0;
  #address = Address.PUBLIC;

  static commandMap: {[command: number]: keyof Protocol} = {};

  constructor(protected serial: SerialPort) {

  }

  registerHandler(command: Command, handler: keyof Protocol) {
    Protocol.commandMap[command] = handler;
  }

  handleMessage(cmd: Command, ...args: any[]) {
    const fnName = Protocol.commandMap[cmd];
    if (!fnName) { throw new Error(`Invalid command: ${cmd.toString(16)}`); }

    const data: number[] = (<any>this[fnName])?.(...args) ?? [];

    const message: number[] = [
      PacketHeader,
      data.length + 3,
      this.__address,
      cmd,
    ];
    // Add LRC checksum
    message.push(checksum(message));

    if (cmd === Command.SET_READER_ADDRESS) {
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

  @register(Command.RESET)
  reset() {
    return [];
  }

  @register( Command.SET_UART_BAUDRATE )
  /**
   * 38400bps or 115200bps.
   */
  baudrate( value = 115200 ) {
    if (value === 115200) return BaudRate.BD_115200;
    else return BaudRate.BD_38400;
  }

  @register( Command.SET_READER_ADDRESS )
  address( addr: Address=0 ) {
    assert ( 0 <= addr && addr <= 254 );
    return [ addr ];
  }

  @register( Command.GET_FIRMWARE_VERSION )
  version() {
      return [];
  }

  @register( Command.SET_WORK_ANTENNA )
  // """ Set reader work antenna.
  //     @param      antenna(int) : 0 ~ 3
  // """
  set_work_antenna( antenna = AntennaID.A1 ) {
      assert ( AntennaID.A1 <= antenna && antenna <= AntennaID.A4 )
      return [ antenna ]
  }

  @register( Command.GET_WORK_ANTENNA )
  get_work_antenna() {
      return [];
  }

  @register( Command.SET_RF_POWER )
  set_rf_power( ant1=OutputPower.MIN, ant2=OutputPower.MIN, ant3=OutputPower.MIN, ant4=OutputPower.MIN ) {
      assert (
        ( OutputPower.MIN <= ant1 && ant1 <= OutputPower.MAX ) &&
        ( OutputPower.MIN <= ant2 && ant2 <= OutputPower.MAX ) &&
        ( OutputPower.MIN <= ant3 && ant3 <= OutputPower.MAX ) &&
        ( OutputPower.MIN <= ant4 && ant4 <= OutputPower.MAX )
      );
      return [ ant1, ant2, ant3, ant4 ];
  }

  @register( Command.GET_RF_POWER )
  get_rf_power() {
      return [];
  }

  @register( Command.SET_TEMPORARY_OUTPUT_POWER )
  fast_power( value = OutputPower.MIN_TEMPORARY ) {
      assert ( OutputPower.MIN_TEMPORARY <= value && value <= OutputPower.MAX );
      return [ value ];
  }

  @register( Command.SET_BEEPER_MODE )
  beeper( mode = BeeperMode.QUIET ) {
      assert ( mode in BeeperMode )
      return [ mode ]
  }

  @register( Command.GET_ANT_CONNECTION_DETECTOR )
  get_ant_connection_detector() {
      return [];
  }

  @register( Command.SET_ANT_CONNECTION_DETECTOR )
  set_ant_connection_detector( loss=AntennaDetector.DISABLED ) {
    // """
    //     @param  loss = 0 # Disabled detector.
    //             loss (Unit:dB) 
    //             (The higher the value, the higher the impedance matching requirements for the port)
    // """
    return [ loss ]
  }

  @register( Command.SET_READER_IDENTIFIER )
  set_reader_identifier( sn = '0123456789AB' ) {
    const data = sn.split('').map(s => s.charCodeAt(0));
    while (data.length < IdentifierLength) {
      data.push(0xff);
    }
    return data;
  }

  @register( Command.GET_READER_IDENTIFIER )
  get_reader_identifier() {
    return [];
  }

  @register( Command.INVENTORY )
  inventory( repeat=InventoryRepeat.MINIMUM ) {
    return [ repeat ]
  }

  @register( Command.GET_INVENTORY_BUFFER )
  get_inventory_buffer() {
    return [];
  }

  @register( Command.GET_INVENTORY_BUFFER_TAG_COUNT )
  get_inventory_buffer_tag_count() {
    return [];
  }
  
  @register( Command.GET_AND_RESET_INVENTORY_BUFFER )
  get_and_reset_inventory_buffer() {
    return [];
  }

  @register( Command.RESET_INVENTORY_BUFFER )  
  reset_inventory_buffer() {
    return [];
  }

  @register( Command.REAL_TIME_INVENTORY )
  rt_inventory( repeat=InventoryRepeat.MINIMUM ) {
    return [ repeat ]
  }

  @register( Command.CUSTOMIZED_SESSION_TARGET_INVENTORY )
  session_inventory( session: keyof typeof SessionID = 'S1', target='A', repeat=1 ) {
    return [
      SessionID[session] || SessionID.S1,
      target === 'B' ? InventoriedFlag.B : InventoriedFlag.A,
      repeat
    ];
  }

  @register( Command.FAST_SWITCH_ANT_INVENTORY )
  fast_switch_ant_inventory( {A, Aloop, B, Bloop, C, Cloop, D, Dloop, Interval, Repeat}: FastSwitchInventoryParams = DefaultFSInventory) {
    return [
      A || AntennaID.DISABLED, 
      Aloop || 1,
      B || AntennaID.DISABLED, 
      Bloop || 1,
      C || AntennaID.DISABLED, 
      Cloop || 1,
      D || AntennaID.DISABLED, 
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

  @register( Command.GET_READER_TEMPERATURE )
  temperature() {
    return [];
  }

  @register( Command.READ )
  read( bank='EPC', addr=0, size=2, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      MemoryBank[bank as 'EPC'] || MemoryBank.EPC,
      addr,
      size,
      ...password,
    ];
    return body;
  }

  @register( Command.WRITE )
  write( data: number[], bank='EPC', addr=0, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      ...password,
      MemoryBank[bank as 'EPC'] || MemoryBank.EPC,
      (bank === 'EPC' && addr === 0) ? 2 : addr,
      Math.floor(data.length / 2),
      ...data,
    ];
    return body;
  }

  // TODO: Should this really be the same as write_block?
  @register( Command.WRITE_BLOCK )
  write_block( data: number[], bank='EPC', addr=0, password=[ 0, 0, 0, 0 ] ) {
    const body = [
      ...password,
      MemoryBank[bank as 'EPC'] || MemoryBank.EPC,
      (bank === 'EPC' && addr === 0) ? 2 : addr,
      Math.floor(data.length / 2),
      ...data,
    ];
    return body;
  }

  @register( Command.LOCK )
  lock( bank='EPC', lock_type='OPEN', password=[ 0, 0, 0, 0 ] ) {
    // """
    //     @param
    //         bank      = [ 'USER', 'TID', 'EPC', 'ACCESS_PASSWORD', 'KILL_PASSWORD' ]
    //         lock_type = [ 'OPEN', 'LOCK', 'OPEN_FOREVER', 'LOCK_FOREVER' ]
    // """
    assert ( Array.isArray(password) );
    
    const body = [
      ...password,
      LockMemoryBank[bank as 'EPC'] || LockMemoryBank.EPC,
      LockType[lock_type as 'OPEN'] || LockType.OPEN,
    ];
    return body;
  }

  @register( Command.KILL )
  kill( password=[ 0, 0, 0, 0 ] ) {
    assert ( Array.isArray(password) );
    return password;
  }

  @register( Command.SET_ACCESS_EPC_MATCH )
  set_access_epc_match( mode: EPCMatch, epc: number[] ) {
    assert( mode in EPCMatch )
    const body = [
      mode,
      epc.length,
      ...epc, 
    ];
    return body;
  }

  @register( Command.GET_ACCESS_EPC_MATCH )
  get_access_epc_match() {
    return [];
  }

  @register( Command.GET_RF_PORT_RETURN_LOSS )
  get_rf_port_return_loss( param: number ) {
    return [ param ]
  }

  @register( Command.SET_FREQUENCY_REGION )
  set_frequency_region( region: number, start: number, stop: number ) {
    return [ region, start, stop ]
  }

  @register( Command.GET_FREQUENCY_REGION )
  get_frequency_region() {
    return [];
  }

  @register( Command.SET_FREQUENCY_REGION )
  set_frequency_region_user( start: number, space: number, quantity: number ) {
    // """
    //     start : e.g. 915000KHz --> 0D F6 38 (unit KHz)
    //     space : space*10 (unit KHz)
    //     quantity : must be above 0
    // """
    assert( quantity > 0 )
    const body = [
      FrequencyRegion.CUSTOM,
      space*10,
      quantity,
      ( ( start & 0x00FF0000 ) >> 16 ) & 0x000000FF,
      ( ( start & 0x0000FF00 ) >>  8 ) & 0x000000FF,
      ( ( start & 0x000000FF ) >>  0 ) & 0x000000FF,
    ];
    return body;
  }

  @register( Command.SET_RF_LINK_PROFILE )
  set_rf_link_profile( profile_id: number ) {
    return [ profile_id ];
  }

  @register( Command.GET_RF_LINK_PROFILE )
  get_rf_link_profile() {
    return [];
  }

  @register( Command.ISO18000_6B_INVENTORY )
  iso1800_6b_inventory() {
    // """ ISO 18000 - 6B """
    return [];
  }
    
};
function checksum(message: number[]): number {
  throw new Error('Function not implemented.');
}

