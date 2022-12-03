import IP from "ipaddr.js";

const LOCAL_RANGES = [
  "10.0.0.0/8",
  "127.0.0.0/8",
  "100.64.0.0/10",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "255.0.0.0/8",
  "fc00::/7",
  "::1/128",
];

export function ipInRange(ip: string, range: string | Iterable<string>) {
  if (typeof range === "string") range = [range];
  const address = IP.parse(ip);

  for (const subnet of range) {
    try {
      if (address.match(IP.parseCIDR(subnet))) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function ipInLocalRange(ip: string) {
  return ipInRange(ip, LOCAL_RANGES);
}

export function* expandRange(range: string) {
  const [subnet, digit] = IP.parseCIDR(range);
  const cls = BigInt(digit);
  const buffer = Buffer.of(...subnet.toByteArray());
  let start = 0n;
  let end = 0n;

  if (subnet.kind() === "ipv4") {
    const value = buffer.readUInt32BE();
    start = (BigInt(value) >> cls) << cls;
    end = start + 2n ** (32n - cls);
  } else if (subnet.kind() === "ipv6") {
    let value = buffer.readBigUInt64BE();
    value <<= 64n;
    value += buffer.readBigUInt64BE(8);
    start = (value >> cls) << cls;
    end = start + 2n ** (128n - cls);
  } else {
    throw new Error("Unrecognized ip class");
  }

  for (; start < end; start++) {
    if (subnet.kind() === "ipv4") {
      buffer.writeUInt32BE(Number(start));
      yield buffer.join(".");
    }

    if (subnet.kind() === "ipv6") {
      buffer.writeBigInt64BE(start >> cls);
      buffer.writeBigInt64BE(start - ((start >> cls) << cls), 8);
      yield buffer.join(":");
    }
  }
}
