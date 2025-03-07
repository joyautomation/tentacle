// import { ModbusSourceParams } from "./modbus/types.ts";
// import { OpcuaSourceParams } from "./opcua/types.ts";

import { createNode } from "@joyautomation/synapse";

export type PlcTask<V extends PlcVariables> = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: PlcVariablesRuntime<V>) => Promise<void> | void;
};

export type PlcTasks<V extends PlcVariables> = Record<
  string,
  PlcTaskRuntime<V>
>;

export type PlcTaskRuntime<V extends PlcVariables> = PlcTask<V> & {
  interval: number;
  metrics: { waitTime: number; executeTime: number };
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
  };
};

export type PlcTasksRuntime<V extends PlcVariables> = Record<
  string,
  PlcTaskRuntime<V>
>;

export type MqttConnection = {
  enabled: boolean;
  name: string;
  description: string;
  serverUrl: string;
  groupId: string;
  nodeId: string;
  deviceId: string;
  clientId: string;
  username: string;
  password: string;
  version?: "spBv1.0";
};

export type PollingSource = {
  enabled: boolean;
  name: string;
  description: string;
  host: string;
  port: number;
  retryRate: number;
};

export type PlcModbusSource = PollingSource & {
  host: string;
  port: number;
  unitId: number;
  reverseBits: boolean;
  reverseWords: boolean;
  zeroBased: false;
  retryRate: number;
};

export type PlcOpcuaSource = PollingSource;

export type PlcConfig<V extends PlcVariables> = {
  tasks: Record<string, PlcTask<V>>;
  mqtt: Record<string, MqttConnection>;
  modbus: Record<string, PlcModbusSource>;
  opcua: Record<string, PlcOpcuaSource>;
  variables: V;
};

export type Plc<V extends PlcVariables> = {
  config: PlcConfig<V>;
  runtime: {
    tasks: PlcTasksRuntime<V>;
    variables: PlcVariablesRuntime<V>;
    mqtt: Record<string, ReturnType<typeof createNode>>;
  };
};

export type PlcVariable =
  | PlcVariableNumber
  | PlcVariableBoolean
  | PlcVariableString
  | PlcVariableUdt<unknown>;

export type PlcVariableRuntime =
  | PlcVariableNumberRuntime
  | PlcVariableBooleanRuntime
  | PlcVariableStringRuntime
  | PlcVariableUdtRuntime<unknown>;

export type PlcVariableBase = {
  id: string;
  description: string;
  persistent?: boolean;
  publishRate?: number;
};

export type PlcVariableNumber = PlcVariableBase & {
  datatype: "number";
  default: number;
};

export type PlcVariableNumberRuntime = PlcVariableNumber & {
  value: number;
};

export type PlcVariableBoolean = PlcVariableBase & {
  datatype: "boolean";
  default: boolean;
};

export type PlcVariableBooleanRuntime = PlcVariableBoolean & {
  value: boolean;
};

export type PlcVariableString = PlcVariableBase & {
  datatype: "string";
  default: string;
};

export type PlcVariableStringRuntime = PlcVariableString & {
  value: string;
};

export type PlcVariableUdt<T> = PlcVariableBase & {
  datatype: "Template";
  default: T;
};

export type PlcVariableUdtRuntime<T> = PlcVariableUdt<T> & {
  value: T;
};

export type PlcVariables<
  T extends Record<string, PlcVariableBase> = Record<
    string,
    PlcVariable
  >,
> = T;

type RuntimeType<T> = T extends PlcVariableBoolean ? PlcVariableBooleanRuntime
  : T extends PlcVariableNumber ? PlcVariableNumberRuntime
  : T extends PlcVariableString ? PlcVariableStringRuntime
  : T extends PlcVariableUdt<infer U> ? PlcVariableUdtRuntime<U>
  : never;

export type PlcVariablesRuntime<T extends PlcVariables> = {
  [K in keyof T]: RuntimeType<T[K]>;
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
