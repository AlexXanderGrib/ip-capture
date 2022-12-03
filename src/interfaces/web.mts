import { Interface } from "./interface.mjs";
import express, { type Application } from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";

import { EventEmitter } from "node:events";
import { App } from "../app.mjs";
import { getDirname } from "../shared/dirname.mjs";

export const web = new (class Web extends EventEmitter implements Interface {
  #server!: Servers;
  #stats: any[] = [];
  #app!: App;

  get #update() {
    return {
      spoofing: this.#app.spoofingIp,
      processor: this.#app.processor,
      players: this.#stats,
      currentIp: this.#app.currentIp,
    };
  }

  async init(application: App): Promise<void> {
    this.#app = application;
    this.#server = await listen();
    const { app, io, port } = this.#server;

    this.emit("listening", { port });
    this.#stats = application.stats;

    app.get("/update", (_req, res) =>
      this.#update
        ? res.status(200).json(this.#stats)
        : res.status(500).json({ status: "not yet" })
    );

    io.on("connect", (socket) => socket.emit("update", this.#update));
  }

  update(stats: App["stats"]) {
    this.#stats = stats;
    this.#server.io.sockets.volatile.emit("update", this.#update);
  }
})();

const port = parseInt(process.env.PORT!) || 0;

type Servers = {
  io: Server;
  app: Application;
  port: number;
};

async function listen() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  const middleware = getDirname(import.meta.url)
    .map(resolve, "../../public")
    .map(express.static).value;

  app.use(middleware);

  return new Promise<Servers>((resolve, reject) => {
    try {
      server.listen(port, () => {
        resolve({
          port: (server.address() as AddressInfo).port,
          app,
          io,
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}
