import { isSourceMqtt } from "./mqtt.ts";
import type {
  PlcMqtts,
  WithMqttSource,
  WithMqttSourceRuntime,
} from "./mqtt.ts";
import {
  isSourceRest,
  type WithRestSource,
  type WithRestSourceRuntime,
} from "./rest.ts";
import {
  isSourceModbus,
  isSourceOpcua,
  isSourceRedis,
  type WithRedisSource,
  type WithRedisSourceRuntime,
  type PlcSources,
  type WithModbusSource,
  type WithModbusSourceRuntime,
  type WithOpcuaSource,
  type WithOpcuaSourceRuntime,
} from "./sources.ts";

export type PlcVariableTag = {
  id: string;
  description: string;
  isTemplate?: boolean;
};

export type PlcVariableTags = Record<string, PlcVariableTag>;

/**
 * Represents a PLC variable with optional source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariable<M extends PlcMqtts, S extends PlcSources> =
  | PlcVariableNumber
  | PlcVariableBoolean
  | PlcVariableString
  | PlcVariableUdt<unknown>
  | PlcVariableNumberWithModbusSource<S>
  | PlcVariableBooleanWithModbusSource<S>
  | PlcVariableStringWithModbusSource<S>
  | PlcVariableUdtWithModbusSource<S, unknown>
  | PlcVariableNumberWithOpcuaSource<S>
  | PlcVariableBooleanWithOpcuaSource<S>
  | PlcVariableStringWithOpcuaSource<S>
  | PlcVariableUdtWithOpcuaSource<S, unknown>
  | PlcVariableNumberWithMqttSource<M>
  | PlcVariableBooleanWithMqttSource<M>
  | PlcVariableStringWithMqttSource<M>
  | PlcVariableUdtWithMqttSource<M, unknown>
  | PlcVariableNumberWithRestSource
  | PlcVariableBooleanWithRestSource
  | PlcVariableStringWithRestSource
  | PlcVariableUdtWithRestSource<unknown>;

/**
 * Represents a runtime instance of a PLC variable with current value.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableRuntime<M extends PlcMqtts, S extends PlcSources> =
  | PlcVariableNumberRuntime
  | PlcVariableBooleanRuntime
  | PlcVariableStringRuntime
  | PlcVariableUdtRuntime<unknown>
  | PlcVariableNumberRuntimeWithModbusSource<S>
  | PlcVariableBooleanRuntimeWithModbusSource<S>
  | PlcVariableStringRuntimeWithModbusSource<S>
  | PlcVariableUdtRuntimeWithModbusSource<S, unknown>
  | PlcVariableNumberRuntimeWithOpcuaSource<S>
  | PlcVariableBooleanRuntimeWithOpcuaSource<S>
  | PlcVariableStringRuntimeWithOpcuaSource<S>
  | PlcVariableUdtRuntimeWithOpcuaSource<S, unknown>
  | PlcVariableNumberRuntimeWithMqttSource<M>
  | PlcVariableBooleanRuntimeWithMqttSource<M>
  | PlcVariableStringRuntimeWithMqttSource<M>
  | PlcVariableUdtRuntimeWithMqttSource<M, unknown>
  | PlcVariableNumberRuntimeWithRestSource
  | PlcVariableBooleanRuntimeWithRestSource
  | PlcVariableStringRuntimeWithRestSource
  | PlcVariableUdtRuntimeWithRestSource<unknown>;

/**
 * Type guard to check if a PLC variable has an associated source configuration (Modbus or OPC UA).
 * @template S - Type extending PlcSources defining available PLC sources
 * @param variable - The variable to check
 * @returns True if the variable has either a Modbus or OPC UA source configuration
 * @public
 */
export function isPlcVariableRuntimeWithSource<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariable<M, S>
>(variable: unknown): variable is PlcVariableRuntimeWithSource<M, S, V> {
  return hasModbusSource(variable) || hasOpcuaSource(variable);
}

/**
 * Represents a runtime PLC variable that has an associated source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableRuntimeWithSource<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariable<M, S>
> =
  | PlcVariableNumberRuntimeWithModbusSource<S>
  | PlcVariableBooleanRuntimeWithModbusSource<S>
  | PlcVariableStringRuntimeWithModbusSource<S>
  | PlcVariableUdtRuntimeWithModbusSource<S, unknown>
  | PlcVariableNumberRuntimeWithOpcuaSource<S>
  | PlcVariableBooleanRuntimeWithOpcuaSource<S>
  | PlcVariableStringRuntimeWithOpcuaSource<S>
  | PlcVariableUdtRuntimeWithOpcuaSource<S, unknown>;

/**
 * Base configuration for all PLC variables.
 * @public
 */
export type PlcVariableBase = {
  id: string;
  description: string;
  publishRate?: number;
};

/** r
 * Configuration for a numeric PLC variable.
 * @public
 */
export type PlcVariableNumber = PlcVariableBase & {
  datatype: "number";
  default: number;
  decimals: number;
  deadband?: {
    maxTime: number;
    value: number;
  };
};

/**
 * Runtime instance of a numeric PLC variable with current value.
 * @public
 */
export type PlcVariableNumberRuntime = PlcVariableNumber &
  PlcVariableRuntimeBase & {
    value: number;
  };

/**
 * Numeric PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableNumberWithModbusSource<S extends PlcSources> =
  PlcVariableNumber & WithModbusSource<S>;
/**
 * Numeric PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableNumberWithOpcuaSource<S extends PlcSources> =
  PlcVariableNumber & WithOpcuaSource<S>;

/**
 * Numeric PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableNumberWithRedisSource<S extends PlcSources> =
  PlcVariableNumber & WithRedisSource<S, number>;

/**
 * Numeric PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableNumberWithMqttSource<M extends PlcMqtts> =
  PlcVariableNumber & WithMqttSource<M>;

/**
 * Numeric PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableNumberWithRestSource = PlcVariableNumber &
  WithRestSource;

/**
 * Runtime instance of a numeric PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableNumberRuntimeWithModbusSource<S extends PlcSources> =
  PlcVariableNumberRuntime & WithModbusSourceRuntime<S>;

/**
 * Runtime instance of a numeric PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableNumberRuntimeWithOpcuaSource<S extends PlcSources> =
  PlcVariableNumberRuntime & WithOpcuaSourceRuntime<S>;

export type PlcVariableNumberRuntimeWithRedisSource<S extends PlcSources> =
  PlcVariableNumberRuntime & WithRedisSourceRuntime<S, number>;

/**
 * Runtime instance of a numeric PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableNumberRuntimeWithMqttSource<M extends PlcMqtts> =
  PlcVariableNumberRuntime & WithMqttSourceRuntime<M>;

/**
 * Runtime instance of a numeric PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableNumberRuntimeWithRestSource = PlcVariableNumberRuntime &
  WithRestSourceRuntime;

/**
 * Configuration for a boolean PLC variable.
 * @public
 */
export type PlcVariableBoolean = PlcVariableBase & {
  datatype: "boolean";
  default: boolean;
};

/**
 * Runtime instance of a boolean PLC variable with current value.
 * @public
 */
export type PlcVariableBooleanRuntime = PlcVariableBoolean &
  PlcVariableRuntimeBase & {
    value: boolean;
  };

/**
 * Boolean PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanWithModbusSource<S extends PlcSources> =
  PlcVariableBoolean & WithModbusSource<S>;
/**
 * Boolean PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanWithOpcuaSource<S extends PlcSources> =
  PlcVariableBoolean & WithOpcuaSource<S>;

/**
 * Boolean PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanWithRedisSource<S extends PlcSources> =
  PlcVariableBoolean & WithRedisSource<S, boolean>;

/**
 * Boolean PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableBooleanWithMqttSource<M extends PlcMqtts> =
  PlcVariableBoolean & WithMqttSource<M>;

/**
 * Boolean PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableBooleanWithRestSource = PlcVariableBoolean &
  WithRestSource;

/**
 * Runtime instance of a boolean PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanRuntimeWithModbusSource<S extends PlcSources> =
  PlcVariableBooleanRuntime & WithModbusSourceRuntime<S>;
/**
 * Runtime instance of a boolean PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanRuntimeWithOpcuaSource<S extends PlcSources> =
  PlcVariableBooleanRuntime & WithOpcuaSourceRuntime<S>;

/**
 * Runtime instance of a boolean PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableBooleanRuntimeWithRedisSource<S extends PlcSources> =
  PlcVariableBooleanRuntime & WithRedisSourceRuntime<S, boolean>;

/**
 * Runtime instance of a boolean PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableBooleanRuntimeWithMqttSource<M extends PlcMqtts> =
  PlcVariableBooleanRuntime & WithMqttSourceRuntime<M>;

/**
 * Runtime instance of a boolean PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableBooleanRuntimeWithRestSource =
  PlcVariableBooleanRuntime & WithRestSourceRuntime;

/**
 * Configuration for a string PLC variable.
 * @public
 */
export type PlcVariableString = PlcVariableBase & {
  datatype: "string";
  default: string;
};

/**
 * Base runtime configuration for a PLC variable.
 *
 * @property {Object} error - Error information
 * @property {string | null} error.error - Error message
 * @property {string | null} [error.message] - Additional error details
 * @public
 */
export type PlcVariableRuntimeBase = {
  error: {
    error: string | null;
    message: string | null;
    stack: string | null;
    timestamp: Date;
  } | null;
};

/**
 * Runtime instance of a string PLC variable with current value.
 * @public
 */
export type PlcVariableStringRuntime = PlcVariableString &
  PlcVariableRuntimeBase & {
    value: string;
  };

/**
 * String PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringWithModbusSource<S extends PlcSources> =
  PlcVariableString & WithModbusSourceRuntime<S>;

/**
 * String PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringWithOpcuaSource<S extends PlcSources> =
  PlcVariableString & WithOpcuaSourceRuntime<S>;

/**
 * String PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringWithRedisSource<S extends PlcSources> =
  PlcVariableString & WithRedisSourceRuntime<S, string>;

/**
 * String PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableStringWithMqttSource<M extends PlcMqtts> =
  PlcVariableString & WithMqttSourceRuntime<M>;

/**
 * String PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableStringWithRestSource = PlcVariableString &
  WithRestSource;

/**
 * Runtime instance of a string PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringRuntimeWithModbusSource<S extends PlcSources> =
  PlcVariableStringRuntime & WithModbusSourceRuntime<S>;
/**
 * Runtime instance of a string PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringRuntimeWithOpcuaSource<S extends PlcSources> =
  PlcVariableStringRuntime & WithOpcuaSourceRuntime<S>;

/**
 * Runtime instance of a string PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableStringRuntimeWithRedisSource<S extends PlcSources> =
  PlcVariableStringRuntime & WithRedisSourceRuntime<S, string>;

/**
 * Runtime instance of a string PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableStringRuntimeWithMqttSource<M extends PlcMqtts> =
  PlcVariableStringRuntime & WithMqttSourceRuntime<M>;

/**
 * Runtime instance of a string PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableStringRuntimeWithRestSource = PlcVariableStringRuntime &
  WithRestSourceRuntime;

/**
 * Configuration for a user-defined type (UDT) PLC variable.
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdt<T> = PlcVariableBase & {
  datatype: "Template";
  default: T;
};

/**
 * Runtime instance of a UDT PLC variable with current value.
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtRuntime<T> = PlcVariableUdt<T> &
  PlcVariableRuntimeBase & {
    value: T;
  };

/**
 * UDT PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtWithModbusSource<
  S extends PlcSources,
  T
> = PlcVariableUdt<T> & WithModbusSource<S>;

/**
 * UDT PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtWithOpcuaSource<
  S extends PlcSources,
  T
> = PlcVariableUdt<T> & WithOpcuaSource<S>;

/**
 * UDT PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtWithRedisSource<
  S extends PlcSources,
  T
> = PlcVariableUdt<T> & WithRedisSource<S, T>;

/**
 * UDT PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableUdtWithMqttSource<
  M extends PlcMqtts,
  T
> = PlcVariableUdt<T> & WithMqttSource<M>;

/**
 * UDT PLC variable with REST source configuration.
 * @public
 */
export type PlcVariableUdtWithRestSource<T> = PlcVariableUdt<T> &
  WithRestSource;

/**
 * Runtime instance of a UDT PLC variable with Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtRuntimeWithModbusSource<
  S extends PlcSources,
  T
> = PlcVariableUdtRuntime<T> & WithModbusSourceRuntime<S>;

/**
 * Runtime instance of a UDT PLC variable with MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @public
 */
export type PlcVariableUdtRuntimeWithMqttSource<
  M extends PlcMqtts,
  T
> = PlcVariableUdtRuntime<T> & WithMqttSourceRuntime<M>;

/**
 * Runtime instance of a UDT PLC variable with OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtRuntimeWithOpcuaSource<
  S extends PlcSources,
  T
> = PlcVariableUdtRuntime<T> & WithOpcuaSourceRuntime<S>;

/**
 * Runtime instance of a UDT PLC variable with Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtRuntimeWithRedisSource<
  S extends PlcSources,
  T
> = PlcVariableUdtRuntime<T> & WithRedisSourceRuntime<S, T>;

/**
 * Runtime instance of a UDT PLC variable with REST source configuration.
 * @template T - Type of the UDT data
 * @public
 */
export type PlcVariableUdtRuntimeWithRestSource<T> = PlcVariableUdtRuntime<T> &
  WithRestSourceRuntime;

/**
 * A collection of PLC variables mapped by their names.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Record type mapping variable names to their configurations, defaults to Record<string, PlcVariable<S>>
 * @public
 */
export type PlcVariables<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends Record<string, PlcVariable<M, S>> = Record<
    string,
    PlcVariable<M, S>
  >
> = V;

/**
 * Runtime version of PlcVariables that includes current values for all variables.
 * Maps each variable to its corresponding runtime type based on its datatype and source configuration.
 *
 * @template S - Type extending PlcSources defining available PLC sources, defaults to PlcSources
 * @template V - Record type mapping variable names to their configurations, defaults to Record<string, PlcVariableRuntime<S>>
 * @public
 */
export type PlcVariablesRuntime<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = {
  [K in keyof V]: V[K] extends PlcVariableBoolean
    ? PlcVariableBooleanRuntime
    : V[K] extends PlcVariableNumber
    ? PlcVariableNumberRuntime
    : V[K] extends PlcVariableString
    ? PlcVariableStringRuntime
    : V[K] extends PlcVariableUdt<infer U>
    ? PlcVariableUdtRuntime<U>
    : V[K] extends PlcVariableNumberWithModbusSource<S>
    ? PlcVariableNumberRuntimeWithModbusSource<S>
    : V[K] extends PlcVariableBooleanWithModbusSource<S>
    ? PlcVariableBooleanRuntimeWithModbusSource<S>
    : V[K] extends PlcVariableStringWithModbusSource<S>
    ? PlcVariableStringRuntimeWithModbusSource<S>
    : V[K] extends PlcVariableUdtWithModbusSource<S, infer U>
    ? PlcVariableUdtRuntimeWithModbusSource<S, U>
    : V[K] extends PlcVariableNumberWithOpcuaSource<S>
    ? PlcVariableNumberRuntimeWithOpcuaSource<S>
    : V[K] extends PlcVariableBooleanWithOpcuaSource<S>
    ? PlcVariableBooleanRuntimeWithOpcuaSource<S>
    : V[K] extends PlcVariableStringWithOpcuaSource<S>
    ? PlcVariableStringRuntimeWithOpcuaSource<S>
    : V[K] extends PlcVariableUdtWithOpcuaSource<S, infer U>
    ? PlcVariableUdtRuntimeWithOpcuaSource<S, U>
    : V[K] extends PlcVariableNumberWithRedisSource<S>
    ? PlcVariableNumberRuntimeWithRedisSource<S>
    : V[K] extends PlcVariableBooleanWithRedisSource<S>
    ? PlcVariableBooleanRuntimeWithRedisSource<S>
    : V[K] extends PlcVariableStringWithRedisSource<S>
    ? PlcVariableStringRuntimeWithRedisSource<S>
    : V[K] extends PlcVariableUdtWithRedisSource<S, infer U>
    ? PlcVariableUdtRuntimeWithRedisSource<S, U>
    : V[K] extends PlcVariableNumberWithMqttSource<M>
    ? PlcVariableNumberRuntimeWithMqttSource<M>
    : V[K] extends PlcVariableBooleanWithMqttSource<M>
    ? PlcVariableBooleanRuntimeWithMqttSource<M>
    : V[K] extends PlcVariableStringWithMqttSource<M>
    ? PlcVariableStringRuntimeWithMqttSource<M>
    : V[K] extends PlcVariableUdtWithMqttSource<M, infer U>
    ? PlcVariableUdtRuntimeWithMqttSource<M, U>
    : V[K] extends PlcVariableNumberWithRestSource
    ? PlcVariableNumberRuntimeWithRestSource
    : V[K] extends PlcVariableBooleanWithRestSource
    ? PlcVariableBooleanRuntimeWithRestSource
    : V[K] extends PlcVariableStringWithRestSource
    ? PlcVariableStringRuntimeWithRestSource
    : V[K] extends PlcVariableUdtWithRestSource<infer U>
    ? PlcVariableUdtRuntimeWithRestSource<U>
    : never;
};

const isVariableType = <T>(
  variable: unknown,
  datatype: string
): variable is T =>
  typeof variable === "object" &&
  variable !== null &&
  "datatype" in variable &&
  variable.datatype === datatype;

/**
 * Type guard to check if a variable is a boolean PLC variable.
 * @param variable - The variable to check
 * @returns True if the variable is a boolean PLC variable
 * @public
 */
export const isVariableBoolean = (
  variable: unknown
): variable is PlcVariableBoolean =>
  isVariableType<PlcVariableBoolean>(variable, "boolean");

/**
 * Type guard to check if a variable is a numeric PLC variable.
 * @param variable - The variable to check
 * @returns True if the variable is a numeric PLC variable
 * @public
 */
export const isVariableNumber = (
  variable: unknown
): variable is PlcVariableNumber =>
  isVariableType<PlcVariableNumber>(variable, "number");

/**
 * Type guard to check if a variable is a string PLC variable.
 * @param variable - The variable to check
 * @returns True if the variable is a string PLC variable
 * @public
 */
export const isVariableString = (
  variable: unknown
): variable is PlcVariableString =>
  isVariableType<PlcVariableString>(variable, "string");

/**
 * Type guard to check if a variable is a user-defined type (UDT) PLC variable.
 * @param variable - The variable to check
 * @returns True if the variable is a UDT PLC variable
 * @public
 */
export const isVariableUdt = (
  variable: unknown
): variable is PlcVariableUdt<unknown> =>
  isVariableType<PlcVariableUdt<unknown>>(variable, "Template");

/**
 * Type guard to check if a variable has a Modbus source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @param variable - The variable to check
 * @returns True if the variable has a Modbus source configuration
 * @public
 */
export const hasModbusSource = <S extends PlcSources>(
  variable: unknown
): variable is WithModbusSource<S> =>
  isSourceModbus((variable as WithModbusSource<S>).source);

/**
 * Type guard to check if a variable has an OPC UA source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @param variable - The variable to check
 * @returns True if the variable has an OPC UA source configuration
 * @public
 */
export const hasOpcuaSource = <S extends PlcSources>(
  variable: unknown
): variable is WithOpcuaSource<S> =>
  isSourceOpcua((variable as WithOpcuaSource<S>).source);

/**
 * Type guard to check if a variable has a Redis source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @param variable - The variable to check
 * @returns True if the variable has a Redis source configuration
 * @public
 */
export const hasRedisSource = <S extends PlcSources, T>(
  variable: unknown
): variable is WithRedisSource<S, T> =>
  isSourceRedis((variable as WithRedisSource<S, T>).source);

/**
 * Type guard to check if a variable has a MQTT source configuration.
 * @template M - Type extending PlcMqtts defining available MQTT connections
 * @param variable - The variable to check
 * @returns True if the variable has a MQTT source configuration
 * @public
 */
export const hasMqttSource = <M extends PlcMqtts>(
  variable: unknown
): variable is WithMqttSource<M> =>
  isSourceMqtt((variable as WithMqttSource<M>).source);

/**
 * Type guard to check if a variable has a REST source configuration.
 * @param variable - The variable to check
 * @returns True if the variable has a REST source configuration
 * @public
 */
export const hasRestSource = (
  variable: unknown
): variable is
  | PlcVariableBooleanRuntimeWithRestSource
  | PlcVariableNumberRuntimeWithRestSource
  | PlcVariableStringRuntimeWithRestSource =>
  isSourceRest((variable as WithRestSource).source);
