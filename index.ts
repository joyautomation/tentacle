import { type ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { logs } from "./log.ts";
import type { PlcConfig } from "./types/types.ts";
import type { PlcSources } from "./types/sources.ts";
import type { PlcVariables } from "./types/variables.ts";
import { createPlc } from "./plc/runtime.ts";
import { addPlcToSchema } from "./plc/graphql.ts";
import { addMemoryUsageToSchema } from "./memory.ts";
const { main } = logs;

/**
 * Creates a new Tentacle PLC instance with GraphQL API.
 *
 * @template S - Type extending PlcSources for source configuration
 * @template V - Type extending PlcVariables for variable configuration
 *
 * @param {PlcConfig<S, V>} config - PLC configuration including sources and variables
 * @param {string} [title] - Title for the GraphQL API, defaults to "tentacle"
 * @param {string} [description] - Description for the GraphQL API, defaults to "Tentacle, a modern software PLC."
 * @param {string} [env_prefix] - Environment variable prefix, defaults to "TENTACLE"
 * @param {Record<string, ArgDictionaryItem>} [userArgDictionary] - Custom CLI argument dictionary
 * @param {number} [port] - Port to run GraphQL server on, defaults to 4123
 * @param {string} [host] - Host to bind GraphQL server to, defaults to "0.0.0.0"
 * @returns {Promise<{plc: Plc<S, V>, app: App}>} - The created PLC instance and GraphQL app
 */
export async function createTentacle<
  S extends PlcSources,
  V extends PlcVariables<S>,
>(
  config: PlcConfig<S, V>,
  title?: string,
  description?: string,
  env_prefix?: string,
  userArgDictionary?: Record<string, ArgDictionaryItem>,
  port?: number,
  host?: string,
): Promise<() => void> {
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
    context,
  );
  return app;
}
