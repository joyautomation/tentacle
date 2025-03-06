import { ArgDictionaryItem } from "https://jsr.io/@joyautomation/conch/0.0.22/cli.ts";
import { ModbusSourceParams } from "./modbus/types.ts";
import { OpcuaSourceParams } from "./opcua/types.ts";

export type PlcTask = {
  description: string;
  scanRate: number;
  program: (variables: Record<string, RealtimeVariable>) => void;
};

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
  vertion?: "spBv1.0";
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

export type PlcConfig = {
  variables: Record<string, Variable>;
  tasks: Record<string, PlcTask>;
  mqtt: Record<string, MqttConnection>;
  modbus: Record<string, PlcModbusSource>;
  opcua: Record<string, PlcOpcuaSource>;
};

export type VariableSourceType =
  | "boolean"
  | "number"
  | "string"
  | "array"
  | "object";

export type VariableSource = {
  name: string;
  type: VariableSourceType;
  description: string;
  default: string;
  rate: number;
  bidirectional: boolean;
  params: ModbusSourceParams | OpcuaSourceParams;
};

export type Variable = {
  id: string;
  datatype: string;
  description: string;
  default: string | number | boolean;
  persistent: boolean;
  source?: VariableSource;
};

export type RealtimeVariable = Variable & {
  value: string | number | boolean;
};
