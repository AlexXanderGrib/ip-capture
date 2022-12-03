import { App } from "../app.mjs";
import { Interface } from "./interface.mjs";

function truncate(str: string, maxLength: number, replacement = "...") {
  if (str.length < maxLength) return str;
  return str.slice(0, maxLength) + replacement;
}
function getLocale() {
  const { env } = process;
  const language =
    env.LANG || env.LANGUAGE || env.LC_ALL || env.LC_MESSAGES || "";
  return language.slice(0, 5).replace("_", "-");
}
const formatter = new Intl.DateTimeFormat([getLocale(), "en-US"], {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  timeZone: "UTC",
});

export const cli = new (class CLI implements Interface {
  public display: Record<string, any> = {};
  async init(): Promise<void> {}

  async update(stats: App["stats"], app: App): Promise<void> {
    this.display.Processor = app.processor.name;
    if (app.spoofingIp) {
      this.display.Spoofing = app.spoofingIp;
    } else {
      delete this.display.Spoofing;
    }

    const suspect = stats.find((x) => x.rank === 1);
    const oldest = stats[0];

    const rows = stats.map((player) => ({
      PPS: Math.round(player.packets.perSecond * 100) / 100,
      IP: player.address.toString(),
      Rank: (player.packets.perSecond > 10 ? Number : String)(player.rank),
      Country: player.ip?.countryCode ?? "??",
      City: truncate(player.ip?.city ?? "Unknown", 16),
      ISP: truncate(player.ip?.isp ?? "Unknown", 16),
      Time: formatter.format(player.sessionTime),
    }));

    console.clear();
    console.log("Total trackable players:", rows.length);

    if (app.currentIp) {
      console.log(
        `You are from ${app.currentIp.countryCode},`,
        stats.filter((s) => s.ip?.countryCode === app.currentIp.countryCode)
          .length,
        "are also"
      );
    }

    if (suspect) {
      console.log(
        "Suspect:",
        `${suspect.address} from ${suspect.ip?.city}, ${suspect.ip?.countryCode}`
      );
    }

    if (oldest) {
      console.log("Session time:", formatter.format(oldest.sessionTime));
    }

    for (const [key, value] of Object.entries(this.display)) {
      console.log(key + ":", value);
    }

    console.log();
    console.table(rows);
  }
})();
