import { Modbus, ModbusFormat, ModbusRegisterType } from "../modbus/types.ts";

export type PlcSourceBase = {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  host: string;
  port: number;
  retryMinDelay?: number;
  retryMaxDelay?: number;
};

export type PlcModbusSource = PlcSourceBase & {
  type: "modbus";
  host: string;
  port: number;
  unitId: number;
  reverseBits: boolean;
  reverseWords: boolean;
};

export type PlcOpcuaSource = PlcSourceBase & {
  type: "opcua";
};

export type PlcModbusSourceRuntime = PlcModbusSource & {
  client: Modbus;
  intervals: ReturnType<typeof setInterval>[];
};

export type PlcOpcuaSourceRuntime = PlcOpcuaSource & {
  client: null;
  intervals: ReturnType<typeof setInterval>[];
};

export type PlcSource = PlcModbusSource | PlcOpcuaSource;

export type PlcSources<
  T extends Record<string, PlcSourceBase> = Record<string, PlcSource>
> = T;

export type PlcSourceRuntimeType =
  | PlcModbusSourceRuntime
  | PlcOpcuaSourceRuntime;

export type PlcSourcesRuntime<T extends PlcSources> = {
  [K in keyof T]: PlcSourceRuntimeType;
};

export type PlcVariableSourceBase = {
  rate: number;
};

export type PlcVariableSourceRuntimeBase = {
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
  };
};

export type PlcVariableModbusSource<S extends PlcSources> =
  PlcVariableSourceBase & {
    id: keyof { [K in keyof S]: S[K] extends PlcModbusSource ? K : never } &
      {
        [K in keyof S]: S[K] extends PlcModbusSource ? K : never;
      }[keyof S];
    type: "modbus";
    register: number;
    registerType: ModbusRegisterType;
    format: ModbusFormat;
  };

export type PlcVariableModbusSourceRuntime<S extends PlcSources> =
  PlcVariableModbusSource<S> & PlcVariableSourceRuntimeBase;

export type PlcVariableOpcuaSource<S extends PlcSources> =
  PlcVariableSourceBase & {
    id: keyof { [K in keyof S]: S[K] extends PlcOpcuaSource ? K : never } &
      {
        [K in keyof S]: S[K] extends PlcOpcuaSource ? K : never;
      }[keyof S];
    type: "opcua";
  };

export type PlcVariableOpcuaSourceRuntime<S extends PlcSources> =
  PlcVariableOpcuaSource<S> & PlcVariableSourceRuntimeBase;

export type WithModbusSource<S extends PlcSources> = {
  source: PlcVariableModbusSource<S>;
};

export type WithModbusSourceRuntime<S extends PlcSources> = {
  source: PlcVariableModbusSourceRuntime<S>;
};

export type WithOpcuaSource<S extends PlcSources> = {
  source: PlcVariableOpcuaSource<S>;
};

export type WithOpcuaSourceRuntime<S extends PlcSources> = {
  source: PlcVariableOpcuaSourceRuntime<S>;
};

export const isSourceModbus = (source: unknown): source is PlcModbusSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "modbus";

export const isSourceOpcua = (source: unknown): source is PlcOpcuaSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  (source as { type: string }).type === "opcua";
