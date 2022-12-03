import { Packet, PacketAddress } from "../net/packets.mjs";
import { CaptureSession } from "../net/session.mjs";
import { PacketProcessor } from "./processor.mjs";
import { TimelineGroup } from "./stats.mjs";

export type PlayerStats = {
  address: PacketAddress;
  packets: {
    total: number;
    perSecond: number;
  };
  sessionTime: number;
};

export class Capturer {
  #processor!: PacketProcessor;
  readonly #session: CaptureSession;
  readonly #stats = new TimelineGroup();

  constructor(session: CaptureSession, processor = new PacketProcessor()) {
    this.#session = session;
    this.processor = processor;
    this.#session.on("packet", this.#onPacket.bind(this));
  }

  set processor(processor: PacketProcessor) {
    this.#session.filter = processor.filter;
    this.#processor = processor;
  }

  get processor() {
    return this.#processor;
  }

  #onPacket(packet: Packet) {
    const address = this.processor.mapper(packet);
    if (!address) return;

    this.#stats.get(address.toString()).increment();
  }

  poll() {
    this.#stats.snapshot();

    const now = Date.now();
    const players: PlayerStats[] = [];
    const ips = new Set<string>();

    for (const [ip, timeline] of this.#stats.entries()) {
      if (timeline.lastActivity + 10_000 < Date.now()) continue;
      let address: PacketAddress;

      try {
        address = PacketAddress.parse(ip);
      } catch {
        continue;
      }

      if (ips.has(address.ip)) continue;

      players.push({
        address,
        packets: {
          total: timeline.total,
          perSecond: timeline.average(),
        },
        sessionTime: now - timeline.start,
      });

      ips.add(address.ip);
    }

    return players;
  }
}
