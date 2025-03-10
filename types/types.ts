// import { ModbusSourceParams } from "./modbus/types.ts";
// import { OpcuaSourceParams } from "./opcua/types.ts";

import { createNode } from "@joyautomation/synapse";
import { PlcVariables, PlcVariablesRuntime } from "./variables.ts";
import { PlcSources, PlcSourcesRuntime } from "./sources.ts";

export type PlcTask<V extends PlcVariables, S extends PlcSources> = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: PlcVariablesRuntime<S, V>) => Promise<void> | void;
};

export type PlcTasks<V extends PlcVariables, S extends PlcSources> = Record<
  string,
  PlcTaskRuntime<V, S>
>;

export type PlcTaskRuntime<
  V extends PlcVariables,
  S extends PlcSources
> = PlcTask<V, S> & {
  interval: number;
  metrics: { waitTime: number; executeTime: number };
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
  };
};

export type PlcTasksRuntime<
  V extends PlcVariables,
  S extends PlcSources
> = Record<string, PlcTaskRuntime<V, S>>;

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

export type PlcConfig<V extends PlcVariables, S extends PlcSources> = {
  tasks: Record<string, PlcTask<V, S>>;
  mqtt: Record<string, MqttConnection>;
  sources: S;
  variables: V;
};

export type Plc<V extends PlcVariables, S extends PlcSources> = {
  config: PlcConfig<V, S>;
  runtime: {
    tasks: PlcTasksRuntime<V, S>;
    variables: PlcVariablesRuntime<S, V>;
    mqtt: Record<string, ReturnType<typeof createNode>>;
    sources: PlcSourcesRuntime<S>;
  };
};
