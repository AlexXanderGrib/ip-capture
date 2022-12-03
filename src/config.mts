import "dotenv/config";
import { PacketProcessor, ipInLocalRange } from "./core.mjs";

export const SPOOF_IP =
  process.env.IP ?? process.env.SPOOF_IP ?? process.env.TARGET_IP;
export const ENABLE_WEB = process.env.RUN_SERVER !== "false";
export const ENABLE_CLI = process.env.ENABLE_CLI !== "false";
export const { USE_IFACE, SCAN_SUBNET } = process.env;

export const processors: PacketProcessor[] = [
  new PacketProcessor("Everything"),
  new PacketProcessor("Sources", undefined, (packet) => packet.source),
  new PacketProcessor(
    "Destinations",
    undefined,
    (packet) => packet.destination
  ),
  new PacketProcessor("Minecraft", "udp", (packet) => {
    const destination = PacketProcessor.defaultMapper(packet);
    if (!destination) return;
    if (destination.port < 10_000) return;
    if (ipInLocalRange(destination.ip)) return;

    return destination;
  }),
  new PacketProcessor("GTA V", "udp", (packet) => {
    if (
      SPOOF_IP &&
      packet.source.ip !== SPOOF_IP &&
      packet.destination.ip !== SPOOF_IP
    ) {
      return;
    }

    const destination = PacketProcessor.defaultMapper(packet);

    const forbiddenPorts = new Set([
      5353, 3544, 3544, 1900, 6667, 61455, 61456, 61457, 61458, 31383, 31384,
      30385,
    ]);

    if (
      !destination?.port ||
      ipInLocalRange(destination.ip) ||
      destination.port < 1000 ||
      forbiddenPorts.has(destination.port)
    ) {
      return;
    }

    return destination;
  }),
];
