import {
  isSourceModbus,
  isSourceOpcua,
  type PlcSources,
  type WithModbusSource,
  type WithModbusSourceRuntime,
  type WithOpcuaSource,
  type WithOpcuaSourceRuntime,
} from "./sources.ts";

/**
 * Represents a PLC variable with optional source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariable<S extends PlcSources> =
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
  | PlcVariableUdtWithOpcuaSource<S, unknown>;

/**
 * Represents a runtime instance of a PLC variable with current value.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableRuntime<S extends PlcSources> =
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
  | PlcVariableUdtRuntimeWithOpcuaSource<S, unknown>;

/**
 * Type guard to check if a PLC variable has an associated source configuration (Modbus or OPC UA).
 * @template S - Type extending PlcSources defining available PLC sources
 * @param variable - The variable to check
 * @returns True if the variable has either a Modbus or OPC UA source configuration
 * @public
 */
export function isPlcVariableRuntimeWithSource<S extends PlcSources>(
  variable: unknown
): variable is PlcVariableRuntimeWithSource<S> {
  return hasModbusSource(variable) || hasOpcuaSource(variable);
}

/**
 * Represents a runtime PLC variable that has an associated source configuration.
 * @template S - Type extending PlcSources defining available PLC sources
 * @public
 */
export type PlcVariableRuntimeWithSource<S extends PlcSources> =
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

/**r
 * Configuration for a numeric PLC variable.
 * @public
 */
export type PlcVariableNumber = PlcVariableBase & {
  datatype: "number";
  default: number;
  deadband?: {
    maxTime: number;
    value: number;
  };
};

/**
 * Runtime instance of a numeric PLC variable with current value.
 * @public
 */
export type PlcVariableNumberRuntime = PlcVariableNumber & PlcVariableRuntimeBase & {
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
export type PlcVariableBooleanRuntime = PlcVariableBoolean & PlcVariableRuntimeBase & {
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
export type PlcVariableStringRuntime = PlcVariableString & PlcVariableRuntimeBase & {
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
export type PlcVariableUdtRuntime<T> = PlcVariableUdt<T> & PlcVariableRuntimeBase & {
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
 * A collection of PLC variables mapped by their names.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Record type mapping variable names to their configurations, defaults to Record<string, PlcVariable<S>>
 * @public
 */
export type PlcVariables<
  S extends PlcSources,
  V extends Record<string, PlcVariable<S>> = Record<string, PlcVariable<S>>
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
  S extends PlcSources = PlcSources,
  V extends Record<string, PlcVariable<S>> = Record<
    string,
    PlcVariableRuntime<S>
  >
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
