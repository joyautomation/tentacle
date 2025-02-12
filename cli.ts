import { type ArgDictionaryItem, createMain } from "@joyautomation/conch";
import { runServer } from "./server.ts";
import { createPlc } from "./plc/runtime.ts";

/**
 * A dictionary of command-line arguments and their properties.
 * @type {Object.<string, ArgDictionaryItem>}
 */
export const builtInArgDictionary: { [key: string]: ArgDictionaryItem } = {};

export const createTentacle = async (
  name: string,
  description: string,
  userArgDictionary: { [key: string]: ArgDictionaryItem },
) => {
  const argDictionary = { ...builtInArgDictionary, ...userArgDictionary };
  /**
   * The main function that runs the mantle application.
   * @async
   * @returns {Promise<void>}
   */
  const context = { plc: await createPlc() };
  return createMain(
    name,
    description,
    "TENTACLE",
    argDictionary,
    runServer,
    true, //mutations
    true, //subscriptions
    context,
  );
};
