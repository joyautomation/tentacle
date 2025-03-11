import { type ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { logs } from "./log.ts";
import { PlcConfig } from "./types/types.ts";
import { PlcSources } from "./types/sources.ts";
import { PlcVariables } from "./types/variables.ts";
import { createPlc } from "./plc/runtime.ts";
import { addPlcToSchema } from "./plc/graphql.ts";
import { addMemoryUsageToSchema } from "./memory.ts";
const { main } = logs;

export async function createTentacle<
  V extends PlcVariables,
  S extends PlcSources
>(
  config: PlcConfig<V, S>,
  title?: string,
  description?: string,
  env_prefix?: string,
  argDictionary?: { [key: string]: ArgDictionaryItem },
  port?: number,
  host?: string
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
      addMemoryUsageToSchema(builder);
      return builder;
    },
    () => {},
    context
  );
  app();
  return app;
}
