// Impinj R2000 ENUMS.
// Ported from https://github.com/hex-in/pyImpinj

import { SerialPort } from 'serialport';
import { FREQUENCY_TABLES, READER_ANTENNA } from './constant';
import { Command, Commands, FastSwitchInventory } from './enums';
import { Protocol } from './protocol';
import { checksum } from './utils';

import eventemitter3 from 'eventemitter3';

const STARTBYTE = 0xA0;
const PADCHAR = '×';

const DEBUG = true;

function debug(...args: Parameters<typeof console.warn>) {
  if (!DEBUG) return;
  return console.warn(...args);
}

interface SerialResponse {
  length: number;
  address: number;
  command: Command;
  data: Buffer;
}

type SerialPortOpenOptions = ConstructorParameters<typeof SerialPort>[0];

function decodeTag(packet: SerialResponse): RFIDTag {
  const freqAnt = packet.data.at(0)!;
  const ant = freqAnt && 0x03;
  const freq = (freqAnt && 0xFC) >> 2;

  const rssi = packet.data.at(-1)!;
  const PC = packet.data.subarray(1, 3);
  const EPC = packet.data.subarray(3, -1);
  return {
    antenna: ant,
    frequency: freq,
    rssi,
    PC: [...PC].map(n => n.toString(16)).join(),
    EPC: [...EPC].map(n => n.toString(16)).join(),
  };
}

function findResponse(data: Buffer) : [SerialResponse, Buffer] | [false] {
  if (data.at(0) !== STARTBYTE || data.length < 2) {
    throw new Error("Invalid data, no start byte!");
  }

  const length = data.at(1)!;
  const totalLen = length + 2;
  if (data.length < totalLen) return [false];

  const totalPacket = data.subarray(0, totalLen);
  const check = totalPacket.at(totalLen - 1);
  const calculated = checksum(totalPacket);
  if (check !== calculated) {
    debug(`Checksum failed on packet!`, totalPacket, `expected ${calculated} received ${check}`);
  }
  const command = data.at(3)! as Command;
  if (!Object.values(Commands).includes(command)) {
    console.warn("Received a response code without a valid command field!", "0x" + [...totalPacket].map(p => `${p.toString(16)}`).join(' '));
  }

  return [{
    length,
    address: data.at(2)!,
    command,
    data: data.subarray(4, length - 2),
  }, data.subarray(totalLen+1)];
}

function decodeResponse(data: Buffer): [SerialResponse, Buffer] | [false] {
  let startIndex = -1;
  while (true) {
    startIndex = data.indexOf(STARTBYTE, startIndex + 1);
    if (startIndex === -1) return [false];
    const [found, remaining] = findResponse(data.subarray(startIndex));
    if (found) {
      return [found, remaining];
    }
  }
}

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

type Resolver<T> = (value: T | PromiseLike<T>) => void;

interface ResponseResolvers {
  [cmd: number]: Resolver<SerialResponse>[];
}

interface RFIDTag {
  frequency: number;
  antenna: number;
  /** 2-byte PC in hex */
  PC: string;
  /** N-byte EPC in hex */
  EPC: string;
  rssi: number;
}

interface R2KReaderEvents {
  tagFound: (tag: RFIDTag, when: Date) => void;
}

export class R2KReader extends eventemitter3<R2KReaderEvents> {
  serial: SerialPort;
  protocol: Protocol;
  response_queue: SerialResponse[] = [];
  dataBuf: Buffer = Buffer.from([]);

  resolvers: ResponseResolvers = {};

  // catch_exception( func ) {
  //     wrapper( *args, **kwargs ) {
  //         try:
  //             return func( *args, **kwargs )
  //         except BaseException as err:
  //             logging.error( str( err ) )
  //             return 0
  //     return wrapper

  // analyze_data( method='RESULT', timeout=3 ) {
  //     decorator( func ) {
  //         wrapper( *args, **kwargs ) {
  //             func( *args, **kwargs )
  //             try:
  //                 data = this.command_queue.get( timeout=timeout )
  //                 if method == 'DATA':
  //                     return data['data']
  //                 else:
  //                     return ( True if data['data'][0] == ImpinjR2KGlobalErrors.SUCCESS else False, ImpinjR2KGlobalErrors.to_string( data['data'][0] ) )
  //             except BaseException as err:
  //                 logging.error( '[ERROR] ANALYZE_DATA error {} or COMMAND QUEUE is timeout.'.format( err ) )
  //                 return bytes( [ ImpinjR2KGlobalErrors.FAIL ] )
  //         return wrapper
  //     return decorator

  constructor( serialPort: SerialPortOpenOptions, protected address = 0xFF ) {
    super();
    const serial = this.serial = new SerialPort(serialPort);

    this.protocol = new Protocol( serial );

    serial.on("data", (chunk: Buffer) => {
      const fullBuf = this.dataBuf = Buffer.concat([this.dataBuf, chunk]);
      const [found, data] = decodeResponse(fullBuf);

      if (found) {
        this.dataBuf = data;
        debug("Received response packet:", found);

        switch(found.command) {
          // There are some command responses which may not be strictly a response to a single command
          case Commands.FAST_SWITCH_ANT_INVENTORY:
          case Commands.REAL_TIME_INVENTORY:
            if (found.length !== 0x0A) {
              // 0x0A is the "succeeded" response, not a tag response
              const tag = decodeTag(found);
              this.emit('tagFound', tag, new Date());
              return;
            }
            break;
          case Commands.FAST_SWITCH_ANT_INVENTORY:

        }

        const res = this.resolvers[found.command]?.shift();
        if (res) {
          // If something is waiting for it then call the resolver
          res(found);  
        } else {
          // If nothing is waiting for it then add it to the response queue
          this.response_queue.push(found);
        }
      }
    });
  }

  waitForResponse(cmd: Command, timeout: number = 250) {
    if (!this.resolvers[cmd]) this.resolvers[cmd] = [];
    return new Promise<SerialResponse>((resolve, reject) => {
      let timedOut = false;
      const tid = setTimeout(() => {
        timedOut = true;
        reject(new Error("timeout"));
      }, timeout);
      const resolveWrapper = (resp: SerialResponse | PromiseLike<SerialResponse>) => {
        if (timedOut) {
          console.warn("Promise resolved after timeout", resp);
          this.resolvers[cmd] = this.resolvers[cmd]?.filter(fn => fn !== resolveWrapper) ?? [];
        } else {
          resolve(resp);
        }
      };
      this.resolvers[cmd].push(resolveWrapper);
    });
  }

  async sendMessage(command: Command, data?: number[], waitResponse?: true) : Promise<SerialResponse>;
  async sendMessage(command: Command, data: number[], waitResponse: false) : Promise<null>;
  async sendMessage(command: Command, data: number[] = [], waitResponse = true) {
    const len = data.length + 2; // length of the p
    const message = [
      STARTBYTE,
      len,
      this.address,
      command,
      ...data,
    ];
    const check = checksum(message);
    message.push(check);
    const bytes = new Uint8Array(check);
    this.serial.write(bytes);
    if (waitResponse) {
      const response = await this.waitForResponse(command);
      return response;
    }
    return null;
  }

  //-------------------------------------------------

  async identifier() {
    const res = await this.sendMessage(Commands.GET_READER_IDENTIFIER, []);
    return String.fromCharCode(...res!.data.filter(Boolean));
  }
  async setIdentifier(ident: string) {
    const newIdent = ident.substring(0, 12).padEnd(12, PADCHAR);
    const data = newIdent.split('').map(c => c === PADCHAR ? 0 : c.charCodeAt(0));
    const res = await this.sendMessage(Commands.SET_READER_IDENTIFIER, data);
  }

  /**
   * Sets the output power
   * @param antenna1 0 to 33 dBm
   * @param antenna2 0 to 33 dBm
   * @param antenna3 0 to 33 dBm
   * @param antenna4 0 to 33 dBm
   */
  async set_output_power( antenna1=20, antenna2=20, antenna3=20, antenna4=20 ) {
    debug( `[SET RF POWER] Antenna1 = ${antenna1}dBm` )
    debug( `[SET RF POWER] Antenna2 = ${antenna2}dBm` )
    debug( `[SET RF POWER] Antenna3 = ${antenna3}dBm` )
    debug( `[SET RF POWER] Antenna4 = ${antenna4}dBm` )
    await this.sendMessage(Commands.SET_RF_POWER, [antenna1, antenna2, antenna3, antenna4]);
    // this.protocol.set_rf_power( ant1=antenna1, ant2=antenna2, ant3=antenna3, ant4=antenna4 )
  }

  get_rf_power() {
    this.protocol.get_rf_power( )
  }

  reset() {
    this.sendMessage(Commands.RESET, [], false);
  }

  /**
   * Use this if you change it frequently so it doesn't save to the EEPROM and reduce the life
   * @param value 20-33dBm
   */
   async fast_power( value=22 ) {
    debug( `[FAST SET RF POWER] ${value}dBm` );
    await this.sendMessage(Commands.SET_TEMPORARY_OUTPUT_POWER, [value]);
  }

  async set_work_antenna( antenna=READER_ANTENNA['ANTENNA1'] ) {
    await this.sendMessage(Commands.SET_WORK_ANTENNA, [antenna]);
  }
  start_real_time_inventory(repeat: number) {
    this.sendMessage(Commands.REAL_TIME_INVENTORY, [repeat], false);
  }

  start_fast_switch_ant_inventory( {A, Aloop, B, Bloop, C, Cloop, D, Dloop, Interval, Repeat}: FastSwitchInventoryParams = DefaultFSInventory) {
    const data = [
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
    this.sendMessage(Commands.FAST_SWITCH_ANT_INVENTORY, data, false);
  }

  get_work_antenna() {
      this.protocol.get_work_antenna( )
  }

  set_ant_connection_detector( loss=0 ) {
      this.protocol.set_ant_connection_detector( loss=loss )
  }

  get_ant_connection_detector() {
      this.protocol.get_ant_connection_detector( )
  }

  async get_rf_port_return_loss( freq=FREQUENCY_TABLES[0] ) {
    const param = FREQUENCY_TABLES.indexOf(freq);
    if (param < 0) throw new Error("Invalid frequency!");

    const resp = await this.sendMessage(Commands.GET_RF_PORT_RETURN_LOSS, [param]);

    return resp.data[0];
  }

  rt_inventory( repeat=1 ) {
      this.protocol.rt_inventory( repeat=repeat )
  }

  session_inventory( session='S1', target='A', repeat=1 ) {
      this.protocol.session_inventory( session='S1', target='A', repeat=1 )
  }

  beeper( mode=0 ) {
      // logging.info( 'BEEPER MODE : {}'.format( mode ) )
      // logging.info( """ MODE: \n 0 : Be quiet \n 1 : Sounds after each inventory \n 2 : Every time a tag is read """ )
      // this.protocol.beeper( mode=mode )
  }

  async temperature() {
    const resp = await this.sendMessage(Commands.GET_READER_TEMPERATURE);
    const isNegative = !!resp.data[0];
    const temp = resp.data[1] * (isNegative ? -1 : 1);
    debug(`Reader temperature is ${temp}℃`);

      // value  = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
      // logging.info( 'Reader temperature is {}C'.format( value[1]*( -1 if value[0] == 0 else 1 ) ) )
      // return value[1]*( -1 if value[0] == 0 else 1 )
  }

  // di( port ) {
  //     // """ Read GPIO
  //     //     @param -> port = 1 or 2
  //     // """
  //     assert( port in ( 1, 2 ) )
  //     this.protocol.gpio( port=port )
  //     value  = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //     return value[0] if port == 1 else value[1]
  // }

  // @analyze_data( )
  // do( port, level=False ) {
  //     // """ Write GPIO
  //     //     @param -> port = 3 or 4
  //     // """
  //     assert( port in ( 3, 4 ) )
  //     logging.info( 'SET GPIO-{} to {}'.format( port, 1 if level else 0 ) )
  //     this.protocol.gpio( port=port, level=level )
  // }

  // // #-------------------------------------------------
  // inventory( repeat=0xFF ) {
  //     this.protocol.inventory( repeat=repeat )
  //     value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //     if ( value[0] == ImpinjR2KGlobalErrors.ANTENNA_MISSING_ERROR ) or ( value[0] == ImpinjR2KGlobalErrors.FAIL ) {
  //         return 0

  //     try:
  //         antenna, tagcount, read_rate, read_total = struct.unpack( '>BHHI', value )
  //     except BaseException as err:
  //         logging.error( err )
  //         logging.error( 'INVENTORY VALUE = {}'.format( value ) )
  //         return 0

  //     logging.info( 'Antenna ID : {}'.format( antenna + 1 ) )
  //     logging.info( 'Tag count  : {}'.format( tagcount    ) )
  //     logging.info( 'Read rate  : {}/s'.format( read_rate   ) )
  //     logging.info( 'Read total : {}'.format( read_total  ) )
  //     return tagcount
  // }

  // get_inventory_buffer_tag_count() {
  //     this.protocol.get_inventory_buffer_tag_count( )
  //     value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //     if ( value[0] == ImpinjR2KGlobalErrors.ANTENNA_MISSING_ERROR ) or ( value[0] == ImpinjR2KGlobalErrors.FAIL ) {
  //         return 0
  //     count = struct.unpack( '>H', value )[0]
  //     logging.info( 'Inventory buffer tag count {}'.format( count ) )
  //     return count
  // }

  // __unpack_inventory_buffer( data ) {
  //     try:
  //         count, length = struct.unpack( '>HB', data[0:3] )
  //     except BaseException as err:
  //         logging.error( err )
  //         return ''

  //     if (length + 6) != len( data ) {
  //         return ''

  //     pc   = struct.unpack( '>H', data[3:5] )[0]
  //     size = ( ( pc & 0xF800 ) >> 10 ) & 0x003E
  //     epc  = ''.join( [ '%02X' % x for x in data[5:size+5] ] )

  //     crc  = struct.unpack( '>H', data[size+5:size+5+2] )[0]
  //     if crc != ( libscrc.xmodem( data[3:size+5], 0xFFFF ) ^ 0xFFFF ) {
  //         logging.error( 'TAGS CRC16 is ERROR.')
  //         return ''

  //     rssi = ( data[-3] - 129  )
  //     ant  = ( data[-2] & 0x03 ) + 1 // Bugfix:20200303
  //     invcount = data[-1]

  //     logging.debug( '*'*50 )
  //     logging.debug( 'COUNT    : {}'.format( count ) )
  //     logging.debug( 'EPC      : {}'.format( epc   ) )
  //     logging.debug( 'CRC      : {:X}'.format( crc ) )
  //     logging.debug( 'RSSI     : {}'.format( rssi  ) )
  //     logging.debug( 'ANT      : {}'.format( ant   ) )
  //     logging.debug( 'INVCOUNT : {}'.format( invcount ) )

  //     return ( ant, rssi, epc )
  // }

  // get_inventory_buffer( loop=1 ) {
  //     // """
  //     //     @return : ( ant, rssi, epc ) -> tuple
  //     // """
  //     tags = []
  //     this.protocol.get_inventory_buffer( )
  //     for _ in range( loop ) {
  //         value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //         tags.append( this.__unpack_inventory_buffer( value ) )
  //     return tags
  // }

  // get_and_reset_inventory_buffer( loop=1 ) {
  //     // """
  //     //     @return : ( ant, rssi, epc ) -> tuple
  //     // """
  //     tags = []
  //     this.protocol.get_and_reset_inventory_buffer( )
  //     for _ in range( loop ) {
  //         value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //         tags.append( this.__unpack_inventory_buffer( value ) )
  //     //### Bugfix:20200302
  //     value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
  //     logging.info( 'GET_AND_RESET_INVENTORY_BUFFER = {}'.format( ImpinjR2KGlobalErrors.to_string( value[0] ) ) )
  //     return tags
  // // }
  
  // @analyze_data( )
  // reset_inventory_buffer() {
  //     this.protocol.reset_inventory_buffer()
  // }

  // // // // -------------------------------------------------
  // @analyze_data( timeout=5 )
  // set_access_epc_match( mode=0, epc='00'*12 ) {
  //     this.protocol.set_access_epc_match( mode=mode, epc=list( bytearray.fromhex( epc ) ) )
  // }

  // read( epc:str, bank='EPC', address=0, size=2, password=[ 0 ]*4 ) {
  //     // """
  //     //     EPC  -> address=0, size=8
  //     //     TID  -> address=0, size=3
  //     //     USER -> address=0, size=2
  //     // """
  //     result = this.set_access_epc_match( mode=0, epc=epc )
  //     if ( len(result) == 0) or (not result[0] ) {
  //         return ''

  //     this.protocol.read( bank=bank, addr=address, size=size, password=password )
  //     value = ImpinjR2KReader.analyze_data( 'DATA', timeout=5 )( lambda x, y : y )( None )

  //     try:
  //         count, length = struct.unpack( '>HB', value[0:3] )
  //     except BaseException:
  //         logging.error( ImpinjR2KGlobalErrors.to_string( value[0] ) )
  //         return ''

  //     pc   = struct.unpack( '>H', value[3:5] )[0]
  //     size = ( ( pc & 0xF800 ) >> 10 ) & 0x003E
  //     epc  = ''.join( [ '%02X' % x for x in value[5:size+5] ] )

  //     crc  = struct.unpack( '>H', value[size+5:size+5+2] )[0]
  //     if crc != ( libscrc.xmodem( value[3:size+5], 0xFFFF ) ^ 0xFFFF ) {
  //         logging.error( 'TAGS CRC16 IS ERROR.')
  //         return ''

  //     datasize = value[-3]
  //     antenna  = ( value[-2] & 0x03 ) + 1
  //     invcount = value[-1]

  //     data_offset_head = size + 5 + 2
  //     data_offset_tail = ( data_offset_head + datasize )

  //     data = ''.join( [ '%02X' % x for x in value[ data_offset_head:data_offset_tail ] ] )

  //     logging.debug( '*'*50 )
  //     logging.debug( 'COUNT    : {}'.format( count  ) )
  //     logging.debug( 'LENGTH   : {}'.format( length ) )
  //     logging.debug( 'SIZE     : {}'.format( size   ) )
  //     logging.debug( 'EPC      : {}'.format( epc    ) )
  //     logging.debug( 'CRC      : {:X}'.format( crc  ) )
  //     logging.debug( 'DATA     : {}'.format( data   ) )
  //     logging.debug( 'DATASIZE : {}'.format( datasize  ) )
  //     logging.debug( 'ANT      : {}'.format( antenna   ) )
  //     logging.debug( 'INVCOUNT : {}'.format( invcount  ) )

  //     return data
  // }

  // write( epc:str, data:str, bank='EPC', address=0, password=[ 0 ]*4 ) {
  //     // """ Write Tag to ( EPC, TID, USER )
  //     //     EPC  -> address=2, size=8
  //     //     TID  -> address=0, size=3
  //     //     USER -> address=0, size=2
  //     // """
  //     assert( type( epc ) is str ) and ( type( data ) is str )

  //     result = this.set_access_epc_match( mode=0, epc=epc )
  //     if ( len(result) == 0) or (not result[0] ) {
  //         return ''

  //     try:
  //         this.protocol.write_block( list( bytearray.fromhex( data ) ),
  //                                     bank=bank,
  //                                     addr=address,
  //                                     password=password )
  //     except BaseException:
  //         logging.error( 'Data must be hex string.' )
  //         return ''

  //     value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )

  //     try:
  //         count, length = struct.unpack( '>HB', value[0:3] )
  //     except BaseException:
  //         logging.error( ImpinjR2KGlobalErrors.to_string( value[0] ) )
  //         return ''

  //     if (length + 6) != len( value ) {
  //         return ''

  //     pc   = struct.unpack( '>H', value[3:5] )[0]
  //     size = ( ( pc & 0xF800 ) >> 10 ) & 0x003E
  //     epc  = ''.join( [ '%02X' % x for x in value[5:size+5] ] )

  //     crc  = struct.unpack( '>H', value[size+5:size+5+2] )[0]
  //     if crc != ( libscrc.xmodem( value[3:size+5], 0xFFFF ) ^ 0xFFFF ) {
  //         logging.error( 'TAGS CRC16 is ERROR.')
  //         return ''
      
  //     error  = ( True if value[-3] == ImpinjR2KGlobalErrors.SUCCESS else False, ImpinjR2KGlobalErrors.to_string( value[-3] ) )
  //     ant    = ( value[-2] & 0x03 ) + 1
  //     wcount = value[-1]

  //     logging.debug( '*'*50 )
  //     logging.debug( 'COUNT      : {}'.format( count ) )
  //     logging.debug( 'EPC        : {}'.format( epc   ) )
  //     logging.debug( 'CRC        : {:X}'.format( crc ) )
  //     logging.debug( 'ERROR      : {}'.format( error ) )
  //     logging.debug( 'ANT        : {}'.format( ant   ) )
  //     logging.debug( 'WriteCount : {}'.format( wcount) )

  //     return epc
  // }

  // // // -------------------------------------------------
  // @analyze_data( )
  // set_frequency_region_user( start_khz, space_khz, quantity ) {
  //     this.protocol.set_frequency_region_user( start=start_khz, space=space_khz, quantity=quantity )
  // }

  // @analyze_data( )
  // set_frequency_region( start, stop, region=ImpinjR2KRegion.FCC ) {
  //     // """
  //     // """
  //     assert ( FREQUENCY_TABLES[0] <= stop  <= FREQUENCY_TABLES[-1] ), 'SEE: constant.FREQUENCY_TABLES'
  //     assert ( FREQUENCY_TABLES[0] <= start <= FREQUENCY_TABLES[-1] ), 'SEE: constant.FREQUENCY_TABLES'
  //     assert ( start <= stop )

  //     try:
  //         start = FREQUENCY_TABLES.index( start )
  //         stop  = FREQUENCY_TABLES.index( stop  )
  //     except ValueError as err:
  //         logging.error( err )
  //         logging.error( FREQUENCY_TABLES )
  //         raise err

  //     this.protocol.set_frequency_region( region=region, start=start, stop=stop )
  // }

  // get_frequency_region() {
  //     this.protocol.get_frequency_region( )
  //     value = ImpinjR2KReader.analyze_data( 'DATA' )( lambda x, y : y )( None )
      
  //     REGION = { 0:'ERROR', 1:'FCC', 2:'ETSI', 3:'CHN', 4:'USER' }

  //     logging.debug( 'Region : {}'.format( REGION.get( value[0], 'ERRROR' ) ) )
  //     if value[0] != ImpinjR2KRegion.USER:
  //         return dict( Region    = REGION.get( value[0], 'ERRROR' ),
  //                       StartFreq = FREQUENCY_TABLES[ value[1] ],
  //                       EndFreq   = FREQUENCY_TABLES[ value[2] ] )
      
  //     StartFreq = ((value[3]<<16) & 0x00FF0000) + ((value[4]<<8)& 0x0000FF00) + value[5]
  //     return dict( Region    = REGION.get( value[0], 'ERRROR' ),
  //                   FreqSpace = value[1] // 10,
  //                   Quantity  = value[2],
  //                   StartFreq = StartFreq )
  // }

  // // // -------------------------------------------------
  // // // Other functions.
  distance( rssi: number, A=60, n=3.5 ) {
      // """ 
      //     @Param
      //         rssi : Signal strength
      //         A : Signal strength at a distance of 1m between the transmitter and the receiver
      //         n : Environmental factor ( 2 - 5)
      // """
      return 10**( ( Math.abs( rssi ) - A ) / ( 10 * n ) )
  }

  get_average( data: number[] ) {
    const sum = data.reduce((memo, cur) => memo + cur, 0);
    return sum / data.length;
  }

  get_variance( data: number[] ) {
    const average = this.get_average( data )
    const variance = this.get_average(data.map(x => ( x - average ) ** 2));
    return variance;
  }
};
