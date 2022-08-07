
import {DefaultFSInventory, FastSwitchInventoryParams, formatPacket, R2KReader} from './main';

const TemperatureInterval = 1000;
const AdjustCooldownInterval = 10000;
const InventoryInterval = 1000;

const ANTENNA_CONNECTED_MIN_RETURN_LOSS = 3;
const MEASURE_RETURN_LOSS_FREQUENCY = 902;

const delayms = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface TagInfo {
  first: Date;
  last: Date;
}

const tagMap: {[id: string]: TagInfo} = {};

async function doSomeCoolStuff() {
  const rdr = new R2KReader({path: '/dev/ttyS0', baudRate: 115200, stopBits: 1, dataBits: 8});

  // await rdr.set_output_power(33, 33, 33, 33);
  let lastTemp = await rdr.temperature();
  let cooldownWait = 50;

  const antennas = ['A', 'B', 'C', 'D'] as const;
  const antEnabled: Partial<Record<typeof antennas[number], boolean>> = {};

  const antennaParams: FastSwitchInventoryParams = DefaultFSInventory;

  // Detect which antenna to use
  let curAnt = 0;
  for (let i = 0; i < antennas.length; ++i) {
    const ant = antennas[i];
    await rdr.set_work_antenna(i);
    const loss = await rdr.get_rf_port_return_loss(902);
    if (loss >= ANTENNA_CONNECTED_MIN_RETURN_LOSS) {
      console.log(`Detected antenna ${ant} connected`);
      const curAntLetter = antennas[curAnt];
      (<any>antEnabled)[curAnt] = i;
      (<any>antennaParams)[curAntLetter] = i;
      (<any>antennaParams)[`${curAntLetter}loop`] = 1;
      curAnt++;
    }
  }

  setInterval(async () => {
    lastTemp = await rdr.temperature();
    console.log(`Reader temperature is ${lastTemp}℃, ${Object.values(tagMap).length} items in inventory, current wait ${cooldownWait}ms`);

    const mult = (lastTemp - 40) / 2;
    cooldownWait = Math.max(50, Math.min(50 * (mult + 1), 750));
  }, 2000);

  // setInterval(async () => {
  //   if (lastTemp > )
  // }, AdjustCooldownInterval);

  rdr.on('tagFound', (tag, when) => {
    const tagName = `${tag.EPC}`;
    if (!(tagName in tagMap)) {
      tagMap[tagName] = {
        first: when,
        last: when,
      };
      console.log(`${Date.now()}: New tag found! ->  ${tagName}`);
    } else {
      tagMap[tagName].last = when;
    }
  });

  while (true) {
    // console.log("Scanning results");
    try {
      const result = await rdr.start_fast_switch_ant_inventory({
        ...antennaParams,
        Interval: 255,
        Repeat: 1
      });
  
      // console.log("Finished our result thingymajig: ", result);
      // console.log(`${Object.keys(tagMap).length} items in inventory`);
    } catch (err) {
      console.warn("Unexpected error reading from rfid reader:", err);
    }
    await delayms(cooldownWait);
  }
}

doSomeCoolStuff().catch(err => console.warn("Unexpected fatal error: ", err));


process.on('unhandledRejection', (reason, p) => {
  // console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
process.on('uncaughtException', function (err) {
  console.log('Caught unhandled exception: ', err);
  console.log("Stack: ", err.stack);
});
