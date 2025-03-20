// import { ModbusSourceParams } from "./modbus/types.ts";
// import { OpcuaSourceParams } from "./opcua/types.ts";

import { createNode } from "@joyautomation/synapse";
import { PlcVariables, PlcVariablesRuntime } from "./variables.ts";
import { PlcSources, PlcSourcesRuntime } from "./sources.ts";
import { LeaseState } from "../lease/lease.ts";
import { createClient } from "redis";
export type PlcTask<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: PlcVariablesRuntime<S, V>) => Promise<void> | void;
};

export type PlcTasks<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = Record<string, PlcTaskRuntime<S, V>>;

export type PlcTaskRuntime<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = PlcTask<S, V> & {
  interval: number;
  metrics: { waitTime: number; executeTime: number };
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
  };
};

export type PlcTasksRuntime<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = Record<string, PlcTaskRuntime<S, V>>;

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

export type PlcHaConfig = {
  lease: string;
  namespace: string;
};

export type PlcHaRuntime = PlcHaConfig & {
  state: LeaseState;
};

export type PlcConfig<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = {
  ha?: PlcHaConfig;
  redisUrl?: string;
  tasks: Record<string, PlcTask<S, V>>;
  mqtt: Record<string, MqttConnection>;
  sources: S;
  variables: V;
};

export type Plc<
  S extends PlcSources,
  V extends PlcVariables<S>,
> = {
  config: PlcConfig<S, V>;
  runtime: {
    ha?: PlcHaRuntime;
    redis?: {
      publisher: ReturnType<typeof createClient>;
      subscriber: ReturnType<typeof createClient>;
    };
    tasks: PlcTasksRuntime<S, V>;
    variables: PlcVariablesRuntime<S, V>;
    mqtt: Record<string, ReturnType<typeof createNode>>;
    sources: PlcSourcesRuntime<S>;
  };
};
