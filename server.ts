import { logs } from "./log.ts";
const { main: log } = logs;
import { createRunServer } from "@joyautomation/conch";
import { addPlcToSchema, createPlc } from "./plc/runtime.ts";
import { Plc } from "./plc/types.ts";

export const runServer = createRunServer<{ plc: Plc }>(
  "MANTLE",
  4000,
  "0.0.0.0",
  log,
  (builder, _args) => {
    addPlcToSchema(builder);
    return builder;
  },
);
