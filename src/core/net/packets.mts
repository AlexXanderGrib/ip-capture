export class AddressParsingError extends Error {
  constructor(address: string, reason?: string) {
    let message = `Invalid address: ${address}`;
    if (reason) message += ` (${reason})`;

    super(message);
  }
}

export class PacketAddress {
  static parse(address: string) {
    const lastColon = address.lastIndexOf(":");
    if (lastColon === -1) throw new AddressParsingError(address);

    const ip = address.slice(0, lastColon);
    const port = parseInt(address.slice(lastColon + 1));

    if (isNaN(port)) {
      throw new AddressParsingError(address, "Port is not a number");
    }

    if (port > 65_535 || port < 0) {
      throw new AddressParsingError(address, "Port is not in a range 0-65535");
    }

    return new PacketAddress(ip, port);
  }

  constructor(public readonly ip: string, public readonly port: number) {}

  toString() {
    return `${this.ip}:${this.port}`;
  }
}

export class Packet {
  constructor(
    public readonly source: PacketAddress,
    public readonly destination: PacketAddress,
    public readonly body: Buffer,
    public readonly raw: Buffer,
    public readonly structured: unknown
  ) {}
}
