import type { createClient } from "redis";
import type { PlcSources, PlcSourcesRuntime } from "./sources.ts";
import type { PlcVariables, PlcVariablesRuntime } from "./variables.ts";
import type { SparkplugNode } from "@joyautomation/synapse";
import type { PlcMqtts } from "./mqtt.ts";

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
export type PlcTask<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = {
  name: string;
  description: string;
  scanRate: number;
  program: (variables: PlcVariablesRuntime<M, S, V>) => Promise<void> | void;
};

/**
 * Map of task IDs to task configurations.
 *
 * @template S - Type extending PlcSources defining available PLC sources
 * @template V - Type extending PlcVariables defining available PLC variables
 */
export type PlcTasks<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = Record<string, PlcTaskRuntime<M, S, V>>;

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
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = PlcTask<M, S, V> & {
  interval: number;
  metrics: {
    wait: {
      start: number
      end: number
      measurement: number
    },
    execute: {
      start: number
      end: number
      measurement: number
    }
  },
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
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = Record<string, PlcTaskRuntime<M, S, V>>;

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
export type PlcConfig<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = {
  redisUrl?: string;
  tasks: Record<string, PlcTask<M, S, V>>;
  mqtt: M;
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
export type Plc<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
> = {
  config: PlcConfig<M, S, V>;
  runtime: {
    redis?: {
      publisher: ReturnType<typeof createClient>;
      subscriber: ReturnType<typeof createClient>;
    };
    tasks: PlcTasksRuntime<M, S, V>;
    variables: PlcVariablesRuntime<M, S, V>;
    mqtt: Record<string, SparkplugNode>;
    sources: PlcSourcesRuntime<S>;
    restSourceIntervals: Record<string, ReturnType<typeof setInterval>>;
  };
};

export type { SparkplugNode } from "@joyautomation/synapse";
