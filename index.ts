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
  S extends PlcSources,
  V extends PlcVariables<S>
>(
  config: PlcConfig<S, V>,
  title?: string,
  description?: string,
  env_prefix?: string,
  userArgDictionary?: Record<string, ArgDictionaryItem>,
  port?: number,
  host?: string
) {
  const { plc } = await createPlc(config);
  const context = { plc };
  const app = createApp(
    title || "tentacle",
    description || "Tentacle, a modern software PLC.",
    env_prefix || "TENTACLE",
    userArgDictionary || {},
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
  return app;
}
