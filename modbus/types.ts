import type { EventEmitter } from "node:events";
import type {
  createModbusClient,
  createModbusErrorProperties,
} from "./client.ts";

/**
 * Extended TCP port options including timeout.
 *
 * @property {number} port - TCP port number
 * @property {number} [timeout] - Connection timeout in milliseconds
 * @public
 */
export interface ExtendedTcpPortOptions {
  /**
   * TCP port number
   */
  port: number;
  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Modbus constants for register types and data formats.
 * @public
 */
export const Modbus = {
  RegisterTypes: {
    HOLDING_REGISTER: "HOLDING_REGISTER",
    INPUT_REGISTER: "INPUT_REGISTER",
    COIL: "COIL",
    DISCRETE_INPUT: "DISCRETE_INPUT",
  },
  Formats: {
    INT16: "INT16",
    INT32: "INT32",
    FLOAT: "FLOAT",
  },
} as const;

/**
 * Type of Modbus register.
 * Can be one of: HOLDING_REGISTER, INPUT_REGISTER, COIL, DISCRETE_INPUT.
 * @public
 */
export type ModbusRegisterType = keyof typeof Modbus.RegisterTypes;

/**
 * Format of Modbus data.
 * Can be one of: INT16, INT32, FLOAT.
 * @public
 */
export type ModbusFormat = keyof typeof Modbus.Formats;

/**
 * Input parameters for creating a Modbus connection.
 * @public
 */
export type ModbusCreateInput = {
  /**
   * Unique identifier for the connection
   */
  id: string;
  /**
   * Host address for the Modbus connection
   */
  host: string;
  /**
   * TCP port number for the Modbus connection
   */
  port: number;
  /**
   * Unit ID for the Modbus device
   */
  unitId: number;
  /**
   * Whether to reverse bits
   */
  reverseBits: boolean;
  /**
   * Whether to reverse words
   */
  reverseWords: boolean;
  /**
   * Optional timeout in milliseconds for Modbus operations
   */
  timeout?: number;
  /**
   * Minimum delay between retry attempts
   */
  retryMinDelay?: number;
  /**
   * Maximum delay between retry attempts
   */
  retryMaxDelay?: number;
};

/**
 * Modbus RTU client type.
 * @public
 */
export type ModbusRTU = ReturnType<typeof createModbusClient>;

export { createModbusClient } from "./client.ts";

/**
 * Modbus client instance.
 * @public
 */
export type ModbusClient = ModbusRTU;

/**
 * Modbus connection object.
 *
 * @property {ModbusCreateInput} - Input parameters for creating the connection
 * @property {ModbusClient} client - Modbus client instance
 * @property {object} states - Connection states
 * @property {EventEmitter} events - Event emitter for connection events
 * @property {object|null} lastError - Last error that occurred
 * @property {number|null} retryTimeout - Current retry timeout
 * @property {number} retryCount - Number of retry attempts
 * @property {number} retryMinDelay - Minimum delay between retry attempts
 * @property {number} retryMaxDelay - Maximum delay between retry attempts
 * @public
 */
export type Modbus = ModbusCreateInput & {
  client: ModbusClient;
  states: {
    connected: boolean;
    disconnected: boolean;
    errored: boolean;
  };
  events: EventEmitter;
  lastError: ReturnType<typeof createModbusErrorProperties> | null;
  retryTimeout: number | null;
  retryCount: number;
  retryMinDelay: number;
  retryMaxDelay: number;
};

export { createModbusErrorProperties } from "./client.ts";

/**
 * Result of reading a Modbus register.
 * @public
 */
export type ReadRegisterResult = Awaited<
  ReturnType<ModbusClient["readHoldingRegisters"]>
>;

/**
 * Result of reading a Modbus coil.
 * @public
 */
export type ReadCoilResult = Awaited<ReturnType<ModbusClient["readCoils"]>>;

/**
 * Type of Modbus connection transition.
 * Can be one of: connect, disconnect, fail.
 * @public
 */
export type ModbusTransition = "connect" | "disconnect" | "fail";

/**
 * Parameters for a Modbus source.
 *
 * @property {ModbusFormat} format - Format of the data
 * @property {number} register - Register number
 * @property {ModbusRegisterType} registerType - Type of the register
 * @public
 */
export type ModbusSourceParams = {
  format: ModbusFormat;
  register: number;
  registerType:
    | "HOLDING_REGISTER"
    | "INPUT_REGISTER"
    | "COIL"
    | "DISCRETE_INPUT";
};
