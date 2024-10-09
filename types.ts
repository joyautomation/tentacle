import { ModbusSourceParams } from "./index.ts";

export type OpcuaSourceParams = {
  registerType: string;
  nodeId: string;
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
