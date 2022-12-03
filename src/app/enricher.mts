import { type Ip, PrismaClient } from "@prisma/client";
import axios, { type AxiosInstance } from "axios";
import { PlayerStats, ipInLocalRange } from "../core.mjs";
import {
  type AsnResponse,
  type CityResponse,
  type CountryResponse,
  Reader,
  type Response,
} from "mmdb-lib";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDirname } from "../shared/dirname.mjs";

export type ExtendedPlayerStats = PlayerStats & {
  ip?: Ip;
};

const readerPath = (name: string) =>
  getDirname(import.meta.url).map(resolve, `../../db/GeoLite2-${name}.mmdb`)
    .value;

async function getReader<T extends Response>(name: string) {
  const contents = await readFile(readerPath(name));
  return new Reader<T>(contents);
}

const [cityReader, countryReader, asnReader] = await Promise.all([
  getReader<CityResponse>("City"),
  getReader<CountryResponse>("Country"),
  getReader<AsnResponse>("ASN"),
]);

type RawIp = Pick<Ip, "isp" | "countryCode" | "city">;

export class Enricher {
  readonly #db = new PrismaClient();
  readonly #ips = new Map<string, Ip>();
  readonly #checklist = new Set<string>();
  readonly #checkers: ((ip: string) => Promise<RawIp | undefined>)[] = [];
  readonly #attempts: Record<string, number> = {};

  async poll() {
    for (const ip of this.#checklist) {
      if (this.#ips.has(ip) || ipInLocalRange(ip) || (this.#attempts[ip] ?? 0) >= 2) {
        this.#checklist.delete(ip);
      }
    }

    if (this.#checklist.size === 0) return;

    await Promise.allSettled(
      [...this.#checklist]
        .slice(0, 5)
        .map((ip) =>
          this.checkIp(ip).then(
            (info) => info && this.#ips.set(info.value, info)
          )
        )
    );
  }

  constructor(private readonly http: AxiosInstance = axios.default.create()) {
    this.#checkers.push(
      async (ip) => {
        const city = cityReader.get(ip)?.city?.names.en;

        if (city) {
          const countryCode = countryReader.get(ip)?.country?.iso_code!;
          const isp = asnReader.get(ip)?.autonomous_system_organization!;

          return {
            city,
            countryCode,
            isp,
          };
        }

        return;
      },
      async (ip) => {
        // console.log("XHT IP", ip);
        const { data } = await this.http.get(`https://api.xxhax.com/ip2`, {
          params: { ip: !ip ? undefined : ip, mode: "fast" },
        });

        return {
          city: data.location.city,
          countryCode: data.location.countryCode2,
          isp: data.organization.name,
        };
      },
      async (ip) => {
        // console.log("IP API", ip);
        const { data } = await this.http.get(`http://ip-api.com/json/${ip}`, {
          params: {
            fields: ["status", "message", "countryCode", "city", "isp"].join(),
          },
        });

        if (data.status !== "success") return;

        return {
          city: data.city,
          countryCode: data.countryCode,
          isp: data.isp,
        };
      },
      async (ip) => {
        // console.log("DB IP", ip);

        const { data } = await this.http.get(
          "https://db-ip.com/demo/home.php",
          { params: { s: ip } }
        );

        if (data.status !== "ok") return;

        return {
          city: data.demoInfo.city,
          countryCode: data.demoInfo.countryCode,
          isp: data.demoInfo.isp,
        };
      },
      async (ip) => {
        // console.log("IP API.co", ip);

        const { data } = await this.http.get(`https://ipapi.co/${ip}/json/`);

        if (!data.country_code) return;

        return {
          city: data.city,
          countryCode: data.country_code,
          isp: data.isp ?? "Unknown",
        };
      }
    );
  }

  enrich(stats: PlayerStats): ExtendedPlayerStats {
    this.#checklist.add(stats.address.ip);

    return {
      ...stats,
      ip: this.#ips.get(stats.address.ip),
    };
  }

  async checkIp(ip: string): Promise<Ip | void> {
    let data = await this.#db.ip.findUnique({ where: { value: ip } });
    if (data) return data;

    for (const check of this.#checkers) {
      try {
        const info = await check(ip);
        if (!info) continue;
        data = { value: ip, ...info, whitelist: false };
        break;
      } catch {}
    }

    this.#attempts[ip] ??= 0
    this.#attempts[ip]++;

    if (!data) return;

    await this.#db.ip.create({ data });
    return data;
  }

  async toggleWhitelist(ip: string) {
    const info = await this.checkIp(ip);
    if (!info) throw new Error("Unable to check ip");

    const result = await this.#db.ip.update({
      where: { value: ip },
      data: { whitelist: !info.whitelist },
    });

    this.#ips.set(ip, result);

    return result;
  }
}
