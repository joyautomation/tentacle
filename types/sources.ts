import type {
  Modbus,
  ModbusFormat,
  ModbusRegisterType,
} from "../modbus/types.ts";
import { Redis } from "../redis/types.ts";

/**
 * Base configuration for a PLC source.
 *
 * @property {string} id - Unique source identifier
 * @property {boolean} enabled - Whether the source is enabled
 * @property {string} name - Source name
 * @property {string} description - Source description
 * @property {string} host - Host address
 * @property {number} port - Port number
 * @property {number} [retryMinDelay] - Minimum delay between retry attempts
 * @property {number} [retryMaxDelay] - Maximum delay between retry attempts
 * @public
 */
export type PlcSourceBase = {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  host: string;
  port: number;
  retryMinDelay: number;
  retryMaxDelay: number;
};

/**
 * Configuration for a Modbus source.
 *
 * @property {string} type - Must be "modbus"
 * @property {string} host - Modbus host address
 * @property {number} port - Modbus port number
 * @property {number} unitId - Modbus unit ID
 * @property {boolean} reverseBits - Whether to reverse bits
 * @property {boolean} reverseWords - Whether to reverse words
 * @property {number} timeout - Connection timeout in milliseconds
 * @public
 */
export type PlcModbusSource = PlcSourceBase & {
  type: "modbus";
  host: string;
  port: number;
  unitId: number;
  reverseBits: boolean;
  reverseWords: boolean;
  timeout: number;
};

/**
 * Configuration for an OPC UA source.
 *
 * @property {string} type - Must be "opcua"
 * @public
 */
export type PlcOpcuaSource = PlcSourceBase & {
  type: "opcua";
};

/**
 * Configuration for an MQTT source.
 *
 * @property {string} type - Must be "mqtt"
 * @public
 */
export type PlcMqttSource = PlcSourceBase & {
  type: "mqtt";
};

/**
 * Configuration for a Redis source.
 *
 * @property {string} type - Must be "redis"
 * @public
 */
export type PlcRedisSource = PlcSourceBase & {
  type: "redis";
  redisUrl: string;
};

/**
 * A PLC source can be either a Modbus or OPC UA source.
 * @public
 */
export type PlcSource =
  | PlcModbusSource
  | PlcOpcuaSource
  | PlcMqttSource
  | PlcRedisSource;

/**
 * Runtime configuration for a Modbus source.
 *
 * @property {Modbus} client - Modbus client instance
 * @property {ReturnType<typeof setInterval>[]} intervals - Active intervals
 * @property {"connected" | "disconnected" | "error"} state - Connection state
 * @public
 */
export type PlcModbusSourceRuntime = PlcModbusSource & {
  client: Modbus;
  intervals: ReturnType<typeof setInterval>[];
  state: "connected" | "disconnected" | "error";
};

/**
 * Runtime configuration for an OPC UA source.
 *
 * @property {null} client - OPC UA client instance
 * @property {ReturnType<typeof setInterval>[]} intervals - Active intervals
 * @property {"connected" | "disconnected" | "error"} state - Connection state
 * @public
 */
export type PlcOpcuaSourceRuntime = PlcOpcuaSource & {
  client: null;
  intervals: ReturnType<typeof setInterval>[];
  state: "connected" | "disconnected" | "error";
};

export type PlcRedisSourceRuntime = PlcRedisSource & {
  client: Redis;
  state: "connected" | "disconnected" | "error";
};

/**
 * Runtime configuration for a PLC source.
 * @public
 */
export type PlcSourceRuntime =
  | PlcModbusSourceRuntime
  | PlcOpcuaSourceRuntime
  | PlcRedisSourceRuntime;

/**
 * Collection of PLC sources mapped by their IDs.
 *
 * @template T - Type extending Record<string, PlcSource>, defaults to Record<string, PlcSource>
 * @public
 */
export type PlcSources<
  T extends Record<string, PlcSource> = Record<string, PlcSource>
> = T;

/**
 * Collection of runtime PLC sources mapped by their IDs.
 *
 * @template T - Type extending PlcSources
 * @property {Record<keyof T, PlcSourceRuntime>} [key: string] - Map of source IDs to runtime configurations
 * @public
 */
export type PlcSourcesRuntime<T extends PlcSources> = {
  [key in keyof T]: PlcSourceRuntime;
};

/**
 * Base configuration for a PLC variable source.
 *
 * @property {number} rate - Update rate in milliseconds
 * @public
 */
export type PlcVariableSourceBase = {
  id: string;
};

/**
 * Base runtime configuration for a PLC variable source.
 *
 * @property {Object} error - Error information
 * @property {string | null} error.error - Error message
 * @property {string | null} [error.message] - Additional error details
 * @property {string | null} [error.stack] - Error stack trace
 * @public
 */
export type PlcVariableSourceRuntimeBase = PlcVariableSourceBase & {
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
    timestamp: Date;
  };
};

/**
 * Configuration for a Modbus variable source.
 *
 * @template S - Type extending PlcSources
 * @property {keyof S} id - ID of the Modbus source
 * @property {"modbus"} type - Must be "modbus"
 * @property {boolean} [bidirectional] - Whether the variable can be read and written
 * @property {(value: string) => number} [onResponse] - Transform function for response values
 * @property {(value: number) => number} [onSend] - Transform function for sent values
 * @property {number} register - Modbus register number
 * @property {ModbusRegisterType} registerType - Type of Modbus register
 * @property {ModbusFormat} format - Format of the Modbus value
 * @public
 */
export type PlcVariableModbusSource<S extends PlcSources> =
  PlcVariableSourceBase & {
    id: keyof { [K in keyof S]: S[K] extends PlcModbusSource ? K : never } &
      {
        [K in keyof S]: S[K] extends PlcModbusSource ? K : never;
      }[keyof S];
    type: "modbus";
    rate: number;
    bidirectional?: boolean;
    onResponse?: (value: string | boolean | number) => number;
    onSend?: (value: number) => number;
    register: number;
    registerType: ModbusRegisterType;
    format: ModbusFormat;
  };

/**
 * Runtime configuration for a Modbus variable source.
 *
 * @template S - Type extending PlcSources
 * @extends {PlcVariableSourceRuntimeBase}
 * @public
 */
export type PlcVariableModbusSourceRuntime<S extends PlcSources> =
  PlcVariableSourceRuntimeBase & PlcVariableModbusSource<S>;

/**
 * Configuration for an OPC UA variable source.
 *
 * @template S - Type extending PlcSources
 * @property {keyof S} id - ID of the OPC UA source
 * @property {"opcua"} type - Must be "opcua"
 * @public
 */
export type PlcVariableOpcuaSource<S extends PlcSources> =
  PlcVariableSourceBase & {
    id: keyof { [K in keyof S]: S[K] extends PlcOpcuaSource ? K : never } &
      {
        [K in keyof S]: S[K] extends PlcOpcuaSource ? K : never;
      }[keyof S];
    type: "opcua";
    rate: number;
  };

/**
 * Runtime configuration for an OPC UA variable source.
 *
 * @template S - Type extending PlcSources
 * @extends {PlcVariableSourceRuntimeBase}
 * @public
 */
export type PlcVariableOpcuaSourceRuntime<S extends PlcSources> =
  PlcVariableSourceRuntimeBase & PlcVariableOpcuaSource<S>;

export type PlcVariableRedisSource<
  S extends PlcSources,
  T
> = PlcVariableSourceBase & {
  id: keyof { [K in keyof S]: S[K] extends PlcRedisSource ? K : never } &
    {
      [K in keyof S]: S[K] extends PlcRedisSource ? K : never;
    }[keyof S];
  type: "redis";
  key: string;
  bidirectional?: boolean;
  onResponse?: (value: string) => T;
  onSend?: (value: T) => string;
};

export type PlcVariableRedisSourceRuntime<
  S extends PlcSources,
  T
> = PlcVariableSourceRuntimeBase & PlcVariableRedisSource<S, T>;

/**
 * Runtime configuration for a variable source.
 *
 * @template S - Type extending PlcSources
 * @public
 */
export type PlcVariableSourceRuntime<S extends PlcSources, T> =
  | PlcVariableModbusSourceRuntime<S>
  | PlcVariableOpcuaSourceRuntime<S>
  | PlcVariableRedisSourceRuntime<S, T>;

/**
 * Mixin for types that have a Modbus source.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableModbusSource<S>} source - Modbus source configuration
 * @public
 */
export type WithModbusSource<S extends PlcSources> = {
  source: PlcVariableModbusSource<S>;
};

/**
 * Mixin for types that have a Modbus source at runtime.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableModbusSourceRuntime<S>} source - Modbus source runtime configuration
 * @public
 */
export type WithModbusSourceRuntime<S extends PlcSources> = {
  source: PlcVariableModbusSourceRuntime<S>;
};

/**
 * Mixin for types that have an OPC UA source.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableOpcuaSource<S>} source - OPC UA source configuration
 * @public
 */
export type WithOpcuaSource<S extends PlcSources> = {
  source: PlcVariableOpcuaSource<S>;
};

/**
 * Mixin for types that have an OPC UA source at runtime.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableOpcuaSourceRuntime<S>} source - OPC UA source runtime configuration
 * @public
 */
export type WithOpcuaSourceRuntime<S extends PlcSources> = {
  source: PlcVariableOpcuaSourceRuntime<S>;
};

/**
 * Mixin for types that have a Redis source.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableRedisSource<S>} source - Redis source configuration
 * @public
 */
export type WithRedisSource<S extends PlcSources, T> = {
  source: PlcVariableRedisSource<S, T>;
};

/**
 * Mixin for types that have a Redis source at runtime.
 *
 * @template S - Type extending PlcSources
 * @property {PlcVariableRedisSourceRuntime<S, T>} source - Redis source runtime configuration
 * @public
 */
export type WithRedisSourceRuntime<S extends PlcSources, T> = {
  source: PlcVariableRedisSourceRuntime<S, T>;
};

/**
 * Type guard to check if a source is a Modbus source.
 *
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is a Modbus source
 * @public
 */
export const isSourceModbus = (source: unknown): source is PlcModbusSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "modbus";

/**
 * Type guard to check if a source is an OPC UA source.
 *
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is an OPC UA source
 * @public
 */
export const isSourceOpcua = (source: unknown): source is PlcOpcuaSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "opcua";

/**
 * Type guard to check if a source is a Redis source.
 *
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is a Redis source
 * @public
 */
export const isSourceRedis = (source: unknown): source is PlcRedisSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "redis";

/**
 * Type guard to check if a source is a Modbus source at runtime.
 *
 * @template S - Type extending PlcSources
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is a Modbus source at runtime
 * @public
 */
export const isVariableModbusSourceRuntime = <S extends PlcSources>(
  source: unknown
): source is PlcVariableModbusSourceRuntime<S> => {
  if (
    typeof source === "object" &&
    source !== null &&
    "type" in source &&
    "register" in source &&
    "registerType" in source &&
    "format" in source
  ) {
    const { type } = source as {
      type: string;
    };
    return type === "modbus";
  }
  return false;
};

/**
 * Type guard to check if a source is an OPC UA source at runtime.
 *
 * @template S - Type extending PlcSources
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is an OPC UA source at runtime
 * @public
 */
export const isVariableOpcuaSourceRuntime = <S extends PlcSources>(
  source: unknown
): source is PlcVariableOpcuaSourceRuntime<S> => {
  if (typeof source === "object" && source !== null && "type" in source) {
    const { type } = source as {
      type: string;
    };
    return type === "opcua";
  }
  return false;
};

/**
 * Type guard to check if a source is a Redis source at runtime.
 *
 * @template S - Type extending PlcSources
 * @param {unknown} source - Source to check
 * @returns {boolean} True if the source is a Redis source at runtime
 * @public
 */
export const isVariableRedisSourceRuntime = <S extends PlcSources, T>(
  source: unknown
): source is PlcVariableRedisSourceRuntime<S, T> => {
  if (typeof source === "object" && source !== null && "type" in source) {
    const { type } = source as {
      type: string;
    };
    return type === "redis";
  }
  return false;
};
