import { type ArgDictionaryItem, createMain } from "@joyautomation/conch";
import { runServer } from "./server.ts";

/**
 * A dictionary of command-line arguments and their properties.
 * @type {Object.<string, ArgDictionaryItem>}
 */
export const argDictionary: { [key: string]: ArgDictionaryItem } = {};

/**
 * The main function that runs the mantle application.
 * @async
 * @returns {Promise<void>}
 */
export const main = createMain(
  "tentacle",
  "Tentacle, a modern software PLC",
  "TENTACLE",
  argDictionary,
  runServer,
  false, //mutations
  false, //subscriptions
);
