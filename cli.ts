import { type ArgDictionaryItem, createMain } from "@joyautomation/conch";
import { runServer } from "./server.ts";
import { createPlc } from "./plc/runtime.ts";

/**
 * A dictionary of command-line arguments and their properties.
 * @type {Object.<string, ArgDictionaryItem>}
 */
export const builtInArgDictionary: { [key: string]: ArgDictionaryItem } = {};
