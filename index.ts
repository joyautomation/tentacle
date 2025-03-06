import { type ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { logs } from "./log.ts";
import { PlcConfig } from "./types.ts";
import { createPlc } from "./plc/runtime.ts";
const { main } = logs;

export async function createTentacle(
  config: PlcConfig,
  title?: string,
  description?: string,
  env_prefix?: string,
  argDictionary?: { [key: string]: ArgDictionaryItem },
  port?: number,
  host?: string
) {
  const context = { plc: await createPlc(config) };
  return createApp(
    title || "tentacle",
    description || "Tentacle, a modern software PLC.",
    env_prefix || "TENTACLE",
    argDictionary || {},
    false, //don' add subscriptions
    false, //don't add mutations
    port || 4001,
    host || "0.0.0.0",
    main,
    (builder, _args) => {
      return builder;
    }
  );
}
