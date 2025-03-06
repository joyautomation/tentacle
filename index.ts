import { type ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { logs } from "./log.ts";
import { PlcConfig } from "./types.ts";
const { main } = logs;

export const createTentacle = (
  config: PlcConfig,
  title?: string,
  description?: string,
  env_prefix?: string,
  argDictionary?: { [key: string]: ArgDictionaryItem },
  port?: number,
  host?: string,
) => {
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
    },
  );
};
