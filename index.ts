import { ArgDictionaryItem, createApp } from "@joyautomation/conch";
import { addPlcToSchema, createPlc } from "./plc/runtime.ts";
import { builtInArgDictionary } from "./cli.ts";
import { logs } from "./log.ts";
import { Plc } from "./plc/types.ts";

export * from "./types.ts";
export * from "./modbus/client.ts";
export * from "./modbus/types.ts";
export * from "./plc/runtime.ts";
export * from "./cli.ts";

export const createTentacle = async (
  name: string,
  description: string,
  userArgDictionary: { [key: string]: ArgDictionaryItem }
) => {
  const argDictionary = { ...builtInArgDictionary, ...userArgDictionary };
  /**
   * The main function that runs the mantle application.
   * @async
   * @returns {Promise<void>}
   */
  const context = { plc: await createPlc() };
  return createApp<{ plc: Plc }>(
    name,
    description,
    "TENTACLE",
    argDictionary,
    true, //mutations
    true, //subscriptions
    4000,
    "0.0.0.0",
    logs.main,
    (builder, _args) => {
      addPlcToSchema(builder);
      return builder;
    },
    () => {},
    context
  );
};
