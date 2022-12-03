import {
  Capturer,
  CaptureSession,
  createSpoofer,
  getArpTable,
  ping,
  getIpHostname,
  forwarding,
  scanSubnet,
  ArpEntry,
} from "../core.mjs";

import { Enricher } from "./enricher.mjs";
import { Ip } from "@prisma/client";

export class App {
  async scanSubnet(
    subnet: string,
    { concurrency = 254 * 16, timeout = 3000 } = {}
  ) {
    const table: ArpEntry[] = [];
    const iterator = scanSubnet(subnet, {
      concurrency,
      timeout,
      networkInterface: this.#session.networkInterface,
    });

    for await (const arp of iterator) table.push(arp);

    return table;
  }

  static async init(networkInterface?: string) {
    const instance = new this(networkInterface);
    networkInterface = instance.#session.networkInterface;
    await instance.#init();

    return instance;
  }

  #currentIp!: Readonly<Ip>;
  #enricher = new Enricher();
  #session: CaptureSession;
  #capturer: Capturer;
  #spoofer?: ReturnType<typeof createSpoofer>;
  #destroyed = false;
  #enrich = this.#enricher.enrich.bind(this.#enricher);

  async #init() {
    const ip = await this.#enricher.checkIp("");

    if (!ip) {
      throw new Error("Unable to get current IP");
    }

    this.#currentIp = Object.freeze(ip);
  }

  get currentIp() {
    return this.#currentIp;
  }

  get stats() {
    return this.#capturer
      .poll()
      .map(this.#enrich)
      .sort((a, b) => b.packets.perSecond - a.packets.perSecond)
      .map((p, index) => ({ ...p, rank: index + 1 }))
      .sort((a, b) => b.sessionTime - a.sessionTime);
  }

  get table() {
    return getArpTable(this.#session.networkInterface);
  }

  async poll() {
    await this.#enricher.poll();
  }

  tick() {
    this.#spoofer?.poison();
  }

  private constructor(networkInterface?: string) {
    this.#session = new CaptureSession(networkInterface);
    this.#capturer = new Capturer(this.#session);
  }

  get processor() {
    return this.#capturer.processor;
  }

  set processor(value) {
    if (this.#destroyed) return;
    this.#capturer.processor = value;
  }

  get forwarding() {
    return forwarding.value;
  }

  set forwarding(value) {
    forwarding.value = value;
  }

  get spoofingIp() {
    return this.#spoofer?.target.ip;
  }

  set spoofingIp(value) {
    if (this.#destroyed) return;

    if (value === undefined) {
      this.#spoofer?.cure();
      this.#spoofer = undefined;
    }

    const table = getArpTable(this.#session.networkInterface);
    const target = table.find((x) => x.ip === value);

    if (!target) {
      throw new Error(
        "Unable to resolve target. Try pinging it before resolving"
      );
    }

    this.forwarding = true;
    this.#spoofer = createSpoofer({ session: this.#session, target });
  }

  async toggleWhitelist(ip: string) {
    await this.#enricher.toggleWhitelist(ip);
  }

  async setSpoofingIp(ip: string) {
    await getIpHostname(ip);
    await ping(ip, { networkInterface: this.#session.networkInterface });
    this.spoofingIp = ip;
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;

    if (this.#spoofer) {
      for (let i = 0; i < 10; i++) this.#spoofer.cure();
    }

    this.#spoofer = undefined;
    this.#session.close();
  }
}
