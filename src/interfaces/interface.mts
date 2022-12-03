import { App } from "../app.mjs";
export interface Interface {
  init(app: App): Promise<void>;
  update(players: App["stats"], app: App): void;
}
