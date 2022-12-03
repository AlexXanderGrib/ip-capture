import "dotenv/config";
import inquirer from "inquirer";
import { App } from "./app.mjs";
import { Interface, cli, web } from "./interfaces.mjs";
import * as config from "./config.mjs";
import { setInterval as timer } from "node:timers/promises";
import exitHook from "exit-hook";

const app = await App.init(config.USE_IFACE);

if (config.SCAN_SUBNET) await app.scanSubnet(config.SCAN_SUBNET);
if (config.SPOOF_IP) await app.setSpoofingIp(config.SPOOF_IP);

const { processor } = await inquirer.prompt({
  name: "processor",
  type: "list",
  message: "Preset",
  choices: config.processors.map((p) => p.name),
});

app.processor = config.processors.find((x) => x.name === processor)!;

const interfaces = new Set<Interface>();

if (config.ENABLE_WEB) {
  interfaces.add(web);
  web.on("listening", ({ port }) => {
    cli.display.Server = `http://localhost:${port}`;
  });
}

if (config.ENABLE_CLI) {
  interfaces.add(cli);
}

for (const iface of interfaces) await iface.init(app);

function tick() {
  for (const iface of interfaces) iface.update(app.stats, app);
  app.tick();
}

setInterval(tick, 1000);
exitHook(() => app.destroy());

for await (const _ of timer(2000)) await app.poll();
