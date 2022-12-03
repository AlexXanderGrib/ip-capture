
import type { Packet, PacketAddress } from "../net/packets.mjs";
import { ipInLocalRange } from "./utils.mjs";

export type PacketMappingFunction = (packet: Packet) => PacketAddress | void;

export class PacketProcessor {
  static readonly defaultMapper: PacketMappingFunction = (packet) =>
    ipInLocalRange(packet.destination.ip) ? packet.source : packet.destination;

  constructor(
    public readonly name: string = "default",
    public readonly filter?: string,
    public readonly mapper = PacketProcessor.defaultMapper
  ) {}
}
