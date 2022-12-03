import { createSession, decode, PcapSession } from "pcap";
import { Packet, PacketAddress } from "./packets.mjs";
import { EventEmitter } from "node:events";

function joinIp(addr: number[]) {
  return addr.length === 4 ? addr.join(".") : addr.join(":");
}

export interface CaptureSession {
  on(event: "packet", handler: (packet: Packet) => void): this;
}

export class CaptureSession extends EventEmitter {
  #session!: PcapSession;
  #networkInterface: string;
  #filter?: string;
  #closed = false;

  get networkInterface() {
    return this.#networkInterface;
  }

  set networkInterface(value) {
    if (this.#closed) return;
    this.#updateSession(value);
    this.#networkInterface = value;
  }

  get filter() {
    return this.#filter;
  }

  set filter(value) {
    if (this.#closed) return;
    this.#updateSession(undefined, value);
    this.#filter = value;
  }

  #updateSession(
    networkInterface = this.#networkInterface,
    filter = this.#filter
  ) {
    if (this.#closed) return;

    const session = createSession(networkInterface ?? "", { filter });
    this.#session?.close();
    this.#session = session.on("packet", (raw: Buffer) => {
      const decoded = decode(raw).payload.payload;
      const body = decoded?.payload?.data ?? Buffer.of();
      let packet: Packet;

      try {
        const source = new PacketAddress(
          joinIp(decoded.saddr.addr),
          decoded.payload.sport
        );

        const destination = new PacketAddress(
          joinIp(decoded.daddr.addr),
          decoded.payload.dport
        );

        packet = new Packet(source, destination, body, raw, decoded);

        this.emit("packet", packet);
      } catch {
        return;
      }
    });
  }

  constructor(networkInterface?: string, filter?: string) {
    super();
    this.#updateSession(networkInterface, filter);
    this.#networkInterface =
      networkInterface ?? (this.#session as any).device_name;
    this.#filter = filter;
  }

  inject(packet: Buffer) {
    this.#session?.inject(packet);
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;

    this.removeAllListeners();
    this.#session?.close();
  }
}
