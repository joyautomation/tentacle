import { ModbusSourceParams } from "./modbus/types.ts";
// import { OpcuaSourceParams } from "./opcua/types.ts";

export type PlcTask = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: VariablesRuntime) => void;
};

export type PlcTasks = Record<string, PlcTaskRuntime>;

export type PlcTaskRuntime = PlcTask & {
  interval: number;
  metrics: { waitTime: number; executeTime: number };
  error: {
    message: string | null;
    stack: string | null;
  };
};

export type PlcTasksRuntime = Record<string, PlcTaskRuntime>;

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
  tasks: Record<string, PlcTask>;
  mqtt: Record<string, MqttConnection>;
  modbus: Record<string, PlcModbusSource>;
  opcua: Record<string, PlcOpcuaSource>;
  variables: Record<string, Variable>;
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
  params: ModbusSourceParams; // | OpcuaSourceParams;
};

export type Variable = {
  id: string;
  datatype: "boolean" | "number" | "string" | "object";
  description: string;
  default: string | number | boolean;
  persistent: boolean;
  deadband?: {
    maxTime: number;
    value: number;
  };
  publishRate?: number;
  source?: VariableSource;
};

export type Variables = Record<string, Variable>;

export type VariableRuntime = Variable & {
  value: boolean | number | string | null;
};

export type VariablesRuntime = Record<string, VariableRuntime>;
