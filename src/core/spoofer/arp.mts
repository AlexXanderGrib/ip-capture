import { readFileSync, writeFileSync } from "node:fs";
import { reverse } from "node:dns/promises";
import { createSocket } from "node:dgram";
import { expandRange } from "../analyzer.mjs";
import { chunked, filter } from "itertools";
import { Chain } from "../../shared/chain.js";

export class ArpEntry {
  constructor(
    public readonly ip: string,
    public readonly mac: string,
    public readonly networkInterface: string,
    public readonly name?: string
  ) {}
}

const space = /\s+/;

const dnsCache: Record<string, string> = {};

export function getIpHostname(ip: string) {
  return reverse(ip)
    .then((names) => names[0] || undefined)
    .catch(() => undefined)
    .then((value) => {
      if (value) dnsCache[ip] = value;
      return value;
    });
}

export function getArpTable(networkInterface?: string) {
  const table = readFileSync("/proc/net/arp", "utf-8");
  const lines = table.split("\n").slice(1);
  const entries: ArpEntry[] = [];

  for (const line of lines) {
    const [ip, , , mac, , device] = line.split(space);

    if (!ip || !mac || !device) continue;

    if (
      (networkInterface && networkInterface !== device) ||
      mac === "00:00:00:00:00:00"
    ) {
      continue;
    }

    entries.push(new ArpEntry(ip, mac, device, dnsCache[ip]));
  }

  return entries;
}

export async function getResolvedArpTable(networkInterface?: string) {
  const promises = getArpTable(networkInterface).map((entry) =>
    getIpHostname(entry.ip).then(
      (hostname) =>
        new ArpEntry(entry.ip, entry.mac, entry.networkInterface, hostname)
    )
  );

  return await Promise.all(promises);
}

export function getRouteTable(networkInterface?: string) {
  const table = readFileSync("/proc/net/route", "utf-8");
  const lines = table.split("\n").slice(1);
  const entries: RouteEntry[] = [];

  for (const line of lines) {
    const [device, destination, gateway, flags] = line.split(space);

    if (!device || !destination || !gateway || !flags) continue;

    if (networkInterface && networkInterface !== device) {
      continue;
    }

    entries.push(
      new RouteEntry(
        device,
        Buffer.from(destination, "hex").reverse().join("."),
        Buffer.from(gateway, "hex").reverse().join("."),
        parseInt(flags, 16)
      )
    );
  }

  return entries;
}

export class RouteEntry {
  constructor(
    public readonly networkInterface: string,
    public readonly destination: string,
    public readonly gateway: string,
    public readonly flags: number
  ) {}
}

export function resolveAnything(search: string, table = getArpTable()) {
  return table.find(
    (e) => e.name === search || e.ip === search || e.mac === search
  );
}

export async function ping(
  ip: string,
  { timeout = 5000, networkInterface = undefined as string | undefined } = {}
) {
  const data = Buffer.from("Fuck my ass");
  const socket = createSocket({
    reuseAddr: true,
    type: "udp4",
    sendBufferSize: data.byteLength,
  });
  const start = Date.now();
  const [PORT_MIN, PORT_MAX] = [49152, 65535];

  const send = () =>
    new Promise<void>((resolve, reject) => {
      const port = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN));

      try {
        socket.send(data, port, ip, (error) => {
          if (error) reject(error);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });

  while (Date.now() < start + timeout) {
    await send().catch((cause) => {
      throw new Error(`Unable to send ping to ${ip}`, { cause });
    });

    const table = getArpTable(networkInterface);
    const resolved = table.find((x) => x.ip === ip);

    if (resolved) return resolved;
  }

  throw new Error("Unable to ping IP");
}

export const forwarding = Object.seal({
  get value() {
    return readFileSync("/proc/sys/net/ipv4/ip_forward", "utf-8") === "1";
  },

  set value(value) {
    writeFileSync("/proc/sys/net/ipv4/ip_forward", String(~~value), "utf-8");
  },
});

export async function* scanSubnet(
  subnet: string,
  {
    concurrency = 254 * 16,
    timeout = 3000,
    networkInterface = undefined as string | undefined,
  } = {}
) {
  const { value: groups } = new Chain(subnet)
    .map(expandRange)
    .map(filter, (x) => !x.endsWith(".0") && !x.endsWith(".255"))
    .map(chunked, concurrency);

  for (const batch of groups) {
    const promises = batch.map(async (ip) => {
      const arp = await ping(ip, { timeout, networkInterface }).catch(
        () => undefined
      );

      if (!arp) return;

      if (!arp.name) {
        const name = await getIpHostname(ip);
        if (name)
          return new ArpEntry(arp.ip, arp.mac, arp.networkInterface, name);
      }

      return arp;
    });

    const results = (await Promise.all(promises)).filter(
      (x): x is ArpEntry => x instanceof ArpEntry
    );

    yield* results;
  }
}
