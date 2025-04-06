import type { createClient } from "redis";
import type { PlcSources, PlcSourcesRuntime } from "./sources.ts";
import type { PlcVariables, PlcVariablesRuntime } from "./variables.ts";
import type { SparkplugNode } from "@joyautomation/synapse";

/**
 * Task configuration for a PLC instance.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 *
 * @property {string} name - Unique task name
 * @property {string} description - Task description
 * @property {number} scanRate - Scan rate for the task
 * @property {(variables: PlcVariablesRuntime<S, V>) => Promise<void> | void} program - Task program
 */
export type PlcTask<S extends PlcSources, V extends PlcVariables<S>> = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: PlcVariablesRuntime<S, V>) => Promise<void> | void;
};

/**
 * Map of task IDs to task configurations.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 */
export type PlcTasks<S extends PlcSources, V extends PlcVariables<S>> = Record<
  string,
  PlcTaskRuntime<S, V>
>;

/**
 * Runtime task configuration for a PLC instance.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 *
 * @property {number} interval - Task interval
 * @property {{ waitTime: number; executeTime: number }} metrics - Task metrics
 * @property {{ error: string | null; message?: string | null; stack?: string | null }} error - Task error
 */
export type PlcTaskRuntime<
  S extends PlcSources,
  V extends PlcVariables<S>
> = PlcTask<S, V> & {
  interval: number;
  metrics: { waitTime: number; executeTime: number };
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
  };
};

/**
 * Map of task IDs to runtime task configurations.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 */
export type PlcTasksRuntime<
  S extends PlcSources,
  V extends PlcVariables<S>
> = Record<string, PlcTaskRuntime<S, V>>;

/**
 * MQTT connection configuration.
 *
 * @property {boolean} enabled - Whether the connection is enabled
 * @property {string} name - Connection name
 * @property {string} description - Connection description
 * @property {string} serverUrl - MQTT server URL
 * @property {string} groupId - Group ID
 * @property {string} nodeId - Node ID
 * @property {string} deviceId - Device ID
 * @property {string} clientId - Client ID
 * @property {string} username - Username
 * @property {string} password - Password
 * @property {"spBv1.0"} [version] - Version
 */
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

/**
 * Configuration for a PLC instance.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 *
 * @property {string} [redisUrl] - Optional Redis URL for state persistence and pub/sub
 * @property {Record<string, PlcTask<S, V>>} tasks - Map of task IDs to task configurations
 * @property {Record<string, MqttConnection>} mqtt - Map of MQTT connection IDs to connection configurations
 * @property {S} sources - Source configurations for the PLC
 * @property {V} variables - Variable configurations for the PLC
 * @public
 */
export type PlcConfig<S extends PlcSources, V extends PlcVariables<S>> = {
  redisUrl?: string;
  tasks: Record<string, PlcTask<S, V>>;
  mqtt: Record<string, MqttConnection>;
  sources: S;
  variables: V;
};

/**
 * PLC instance.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 *
 * @property {PlcConfig<S, V>} config - PLC configuration
 * @property {Object} runtime - PLC runtime state
 * @property {Object} [runtime.redis] - Redis client instances
 * @property {ReturnType<typeof createClient>} runtime.redis.publisher - Redis publisher client
 * @property {ReturnType<typeof createClient>} runtime.redis.subscriber - Redis subscriber client
 * @property {PlcTasksRuntime<S, V>} runtime.tasks - Runtime task instances
 * @property {PlcVariablesRuntime<S, V>} runtime.variables - Runtime variable values
 * @property {Record<string, SparkplugNodeWrapper>} runtime.mqtt - MQTT client instances
 * @property {PlcSourcesRuntime<S>} runtime.sources - Runtime source states
 * @public
 */
export type Plc<S extends PlcSources, V extends PlcVariables<S>> = {
  config: PlcConfig<S, V>;
  runtime: {
    redis?: {
      publisher: ReturnType<typeof createClient>;
      subscriber: ReturnType<typeof createClient>;
    };
    tasks: PlcTasksRuntime<S, V>;
    variables: PlcVariablesRuntime<S, V>;
    mqtt: Record<string, SparkplugNode>;
    sources: PlcSourcesRuntime<S>;
  };
};

export type { SparkplugNode } from "@joyautomation/synapse";
