import { ModbusSourceParams } from "./modbus/types.ts";
import { OpcuaSourceParams } from "./opcua/types.ts";

export type PlcTask = {
  description: string;
  scanRate: number;
  program: string;
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
  tasks: {
    [key: string]: PlcTask;
  };
  mqtt: {
    [key: string]: MqttConnection;
  };
  modbus: {
    [key: string]: PlcModbusSource;
  };
  opcua: {
    [key: string]: OpcuaSourceParams;
  };
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
