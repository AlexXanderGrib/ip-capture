import { struct, types } from "ts-struct";

export enum EtherType {
  Ether = 0x0001,
  IPv4 = 0x0800,
  ARP = 0x0806,
  IPv6 = 0x86dd,
}

export class MacAddress extends struct.bigEndian({
  value: types.bytes(6),
}) {
  static readonly TYPE = EtherType.Ether;
  static readonly DEFAULT = new MacAddress("00:00:00:00:00:00");

  constructor(public readonly address: string) {
    const raw = address.replace(/[-:]/g, "");
    const value = Buffer.from(raw, "hex").slice(0, MacAddress.SIZE);

    super({ value });
  }
}

export class IPv4Address extends struct.bigEndian({
  value: types.bytes(4),
}) {
  static readonly TYPE = EtherType.IPv4;
  static readonly DEFAULT = new MacAddress("0.0.0.0");

  constructor(public readonly address: string) {
    const raw = address.split(".").map((part) => parseInt(part, 10));
    const value = Buffer.from(raw).slice(0, IPv4Address.SIZE);

    super({ value });
  }
}

export enum ARPOperation {
  REQUEST = 0x00_01,
  REPLY = 0x00_02,
}

const net = Object.freeze({
  ether: types.enum<EtherType>(types.uint16, EtherType, EtherType.Ether),
  mac: types.any(MacAddress, MacAddress.DEFAULT.address),
  ipv4: types.any(IPv4Address, IPv4Address.DEFAULT.address),
  arpOperation: types.enum<ARPOperation>(
    types.uint16,
    ARPOperation,
    ARPOperation.REPLY
  ),
});

export const Ethernet = struct.bigEndian({
  source: net.mac,
  target: net.mac,
  type: net.ether,
});

export class ARP extends struct.bigEndian({
  hardwareAddressType: net.ether,
  protocolAddressType: net.ether,

  hardwareAddressSize: types.uint8,
  protocolAddressSize: types.uint8,

  type: net.arpOperation,

  sourceHardwareAddress: net.mac,
  sourceProtocolAddress: net.ipv4,

  targetHardwareAddress: net.mac,
  targetProtocolAddress: net.ipv4,
}) {
  constructor({
    sourceHardwareAddress,
    sourceProtocolAddress,
    targetHardwareAddress,
    targetProtocolAddress,
    type = ARPOperation.REPLY,
  }: Pick<
    ARP["data"],
    | "sourceHardwareAddress"
    | "sourceProtocolAddress"
    | "targetHardwareAddress"
    | "targetProtocolAddress"
  > &
    Partial<Pick<ARP["data"], "type">>) {
    super({
      hardwareAddressType: MacAddress.TYPE,
      protocolAddressType: IPv4Address.TYPE,
      hardwareAddressSize: MacAddress.SIZE,
      protocolAddressSize: IPv4Address.SIZE,
      type,
      sourceHardwareAddress,
      sourceProtocolAddress,
      targetHardwareAddress,
      targetProtocolAddress,
    });
  }
}
