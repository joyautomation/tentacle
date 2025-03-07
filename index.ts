import { type ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { logs } from "./log.ts";
import { PlcConfig, PlcVariables } from "./types.ts";
import { createPlc } from "./plc/runtime.ts";
import { addPlcToSchema } from "./plc/graphql.ts";
const { main } = logs;

export async function createTentacle<V extends PlcVariables>(
  config: PlcConfig<V>,
  title?: string,
  description?: string,
  env_prefix?: string,
  argDictionary?: { [key: string]: ArgDictionaryItem },
  port?: number,
  host?: string,
) {
  const context = { plc: await createPlc(config) };
  const app = await createApp(
    title || "tentacle",
    description || "Tentacle, a modern software PLC.",
    env_prefix || "TENTACLE",
    argDictionary || {},
    true, //add subscriptions
    true, //add mutations
    port || 4123,
    host || "0.0.0.0",
    main,
    (builder, _args) => {
      addPlcToSchema(builder);
      return builder;
    },
    () => {},
    context,
  );
  app();
  return app;
}
