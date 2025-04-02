import {
  isSourceModbus,
  isSourceOpcua,
  type PlcSources,
  type WithModbusSource,
  type WithModbusSourceRuntime,
  type WithOpcuaSource,
  type WithOpcuaSourceRuntime,
} from "./sources.ts";

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

export function isPlcVariableRuntimeWithSource<S extends PlcSources>(
  variable: unknown,
): variable is PlcVariableRuntimeWithSource<S> {
  return hasModbusSource(variable) || hasOpcuaSource(variable);
}

export type PlcVariableRuntimeWithSource<S extends PlcSources> =
  | PlcVariableNumberRuntimeWithModbusSource<S>
  | PlcVariableBooleanRuntimeWithModbusSource<S>
  | PlcVariableStringRuntimeWithModbusSource<S>
  | PlcVariableUdtRuntimeWithModbusSource<S, unknown>
  | PlcVariableNumberRuntimeWithOpcuaSource<S>
  | PlcVariableBooleanRuntimeWithOpcuaSource<S>
  | PlcVariableStringRuntimeWithOpcuaSource<S>
  | PlcVariableUdtRuntimeWithOpcuaSource<S, unknown>;

export type PlcVariableBase = {
  id: string;
  description: string;
  publishRate?: number;
};

export type PlcVariableNumber = PlcVariableBase & {
  datatype: "number";
  default: number;
  deadband?: {
    maxTime: number;
    value: number;
  };
};

export type PlcVariableNumberRuntime = PlcVariableNumber & {
  value: number;
};

export type PlcVariableNumberWithModbusSource<S extends PlcSources> =
  & PlcVariableNumber
  & WithModbusSource<S>;
export type PlcVariableNumberWithOpcuaSource<S extends PlcSources> =
  & PlcVariableNumber
  & WithOpcuaSource<S>;

export type PlcVariableNumberRuntimeWithModbusSource<S extends PlcSources> =
  & PlcVariableNumberRuntime
  & WithModbusSource<S>;
export type PlcVariableNumberRuntimeWithOpcuaSource<S extends PlcSources> =
  & PlcVariableNumberRuntime
  & WithOpcuaSource<S>;

export type PlcVariableBoolean = PlcVariableBase & {
  datatype: "boolean";
  default: boolean;
};

export type PlcVariableBooleanRuntime = PlcVariableBoolean & {
  value: boolean;
};

export type PlcVariableBooleanWithModbusSource<S extends PlcSources> =
  & PlcVariableBoolean
  & WithModbusSource<S>;
export type PlcVariableBooleanWithOpcuaSource<S extends PlcSources> =
  & PlcVariableBoolean
  & WithOpcuaSource<S>;

export type PlcVariableBooleanRuntimeWithModbusSource<S extends PlcSources> =
  & PlcVariableBooleanRuntime
  & WithModbusSourceRuntime<S>;
export type PlcVariableBooleanRuntimeWithOpcuaSource<S extends PlcSources> =
  & PlcVariableBooleanRuntime
  & WithOpcuaSourceRuntime<S>;

export type PlcVariableString = PlcVariableBase & {
  datatype: "string";
  default: string;
};

export type PlcVariableStringRuntime = PlcVariableString & {
  value: string;
};

export type PlcVariableStringWithModbusSource<S extends PlcSources> =
  & PlcVariableString
  & WithModbusSourceRuntime<S>;
export type PlcVariableStringWithOpcuaSource<S extends PlcSources> =
  & PlcVariableString
  & WithOpcuaSourceRuntime<S>;

export type PlcVariableStringRuntimeWithModbusSource<S extends PlcSources> =
  & PlcVariableStringRuntime
  & WithModbusSourceRuntime<S>;
export type PlcVariableStringRuntimeWithOpcuaSource<S extends PlcSources> =
  & PlcVariableStringRuntime
  & WithOpcuaSourceRuntime<S>;

export type PlcVariableUdt<T> = PlcVariableBase & {
  datatype: "Template";
  default: T;
};

export type PlcVariableUdtRuntime<T> = PlcVariableUdt<T> & {
  value: T;
};

export type PlcVariableUdtWithModbusSource<
  S extends PlcSources,
  T,
> = PlcVariableUdt<T> & WithModbusSource<S>;
export type PlcVariableUdtWithOpcuaSource<
  S extends PlcSources,
  T,
> = PlcVariableUdt<T> & WithOpcuaSource<S>;

export type PlcVariableUdtRuntimeWithModbusSource<
  S extends PlcSources,
  T,
> = PlcVariableUdtRuntime<T> & WithModbusSourceRuntime<S>;
export type PlcVariableUdtRuntimeWithOpcuaSource<
  S extends PlcSources,
  T,
> = PlcVariableUdtRuntime<T> & WithOpcuaSourceRuntime<S>;

export type PlcVariables<
  S extends PlcSources,
  V extends Record<string, PlcVariable<S>> = Record<string, PlcVariable<S>>,
> = V;

export type PlcVariablesRuntime<
  S extends PlcSources = PlcSources,
  V extends Record<string, PlcVariable<S>> = Record<
    string,
    PlcVariableRuntime<S>
  >,
> = {
  [K in keyof V]: V[K] extends PlcVariableBoolean ? PlcVariableBooleanRuntime
    : V[K] extends PlcVariableNumber ? PlcVariableNumberRuntime
    : V[K] extends PlcVariableString ? PlcVariableStringRuntime
    : V[K] extends PlcVariableUdt<infer U> ? PlcVariableUdtRuntime<U>
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
  datatype: string,
): variable is T =>
  typeof variable === "object" &&
  variable !== null &&
  "datatype" in variable &&
  variable.datatype === datatype;

export const isVariableBoolean = (
  variable: unknown,
): variable is PlcVariableBoolean =>
  isVariableType<PlcVariableBoolean>(variable, "boolean");

export const isVariableNumber = (
  variable: unknown,
): variable is PlcVariableNumber =>
  isVariableType<PlcVariableNumber>(variable, "number");

export const isVariableString = (
  variable: unknown,
): variable is PlcVariableString =>
  isVariableType<PlcVariableString>(variable, "string");

export const isVariableUdt = (
  variable: unknown,
): variable is PlcVariableUdt<unknown> =>
  isVariableType<PlcVariableUdt<unknown>>(variable, "Template");

export const hasModbusSource = <S extends PlcSources>(
  variable: unknown,
): variable is WithModbusSource<S> =>
  isSourceModbus((variable as WithModbusSource<S>).source);

export const hasOpcuaSource = <S extends PlcSources>(
  variable: unknown,
): variable is WithOpcuaSource<S> =>
  isSourceOpcua((variable as WithOpcuaSource<S>).source);
