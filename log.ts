import {
  createLogger,
  type Log,
  LogLevel,
  setEnabled as setCoralLogEnable,
  setLogLevel as setCoralLogLevel,
} from "@joyautomation/coral";

/**
 * Determines the log level based on the environment variable.
 * @returns {LogLevel} The determined log level.
 */
export function getLogLevel(): LogLevel {
  const envLogLevel = Deno.env.get("TENTACLE_LOG_LEVEL");
  if (envLogLevel && envLogLevel in LogLevel) {
    return LogLevel[envLogLevel as keyof typeof LogLevel];
  }
  return LogLevel.debug;
}

/**
 * Creates and exports a logger instance for the "Tentacle" module.
 * The log level is determined by the getLogLevel function.
 */
const createTentacleLog = (name: string): Log =>
  createLogger(`tentacle${name ? "-" : ""}${name}`, getLogLevel());

/**
 * Object containing all logger instances used in the Tentacle module.
 * @property {Log} main - The main logger for general Tentacle logging.
 * @property {Log} rbe - The logger for Report By Exception (RBE) functionality.
 */
export const logs: Record<string, Log> = {
  main: createTentacleLog(""),
};

/**
 * Disables a specific logger.
 * @param {keyof typeof logs} name - The name of the logger to disable.
 * @returns {Log} The disabled logger instance.
 */
export const disableLog = (name: keyof typeof logs): Log => {
  return setCoralLogEnable(logs[name], false);
};

/**
 * Enables a specific logger.
 * @param {keyof typeof logs} name - The name of the logger to enable.
 * @returns {Log} The enabled logger instance.
 */
export const enableLog = (name: keyof typeof logs): Log => {
  return setCoralLogEnable(logs[name], true);
};

/**
 * Sets the log level for the logger.
 * @param {LogLevel} level - The log level to set.
 */
export const setLogLevel = (level: LogLevel): Log[] => {
  return Object.values(logs).map((log) => setCoralLogLevel(log, level));
};
