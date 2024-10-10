import { logs } from "./log.ts";
const { main: log } = logs;
import { createRunServer } from "@joyautomation/conch";

export const runServer = createRunServer(
  "MANTLE",
  4000,
  "0.0.0.0",
  log,
  (builder, _args) => {
    return builder;
  },
);
