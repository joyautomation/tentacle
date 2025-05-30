import { isSuccess, rTry, rTryAsync } from "@joyautomation/dark-matter";
import type { Plc, PlcConfig, PlcTaskRuntime } from "../types/types.ts";
import { isFail } from "@joyautomation/dark-matter";
import { createPlcMqtt, updateMetricValues } from "../synapse.ts";
import { rateLimitedPublish } from "../pubsub.ts";
import {
  isSourceModbus,
  isSourceOpcua,
  isSourceRedis,
  PlcRedisSourceRuntime,
  type PlcModbusSource,
  type PlcSources,
  type PlcSourcesRuntime,
} from "../types/sources.ts";
import {
  hasModbusSource,
  hasOpcuaSource,
  hasRedisSource,
  hasRestSource,
  isVariableBoolean,
  isVariableNumber,
  isVariableString,
  isVariableUdt,
  type PlcVariables,
  type PlcVariablesRuntime,
} from "../types/variables.ts";
import {
  createModbus,
  createModbusErrorProperties,
  readModbus,
  writeModbus,
  failModbus,
} from "../modbus/client.ts";
import {
  getPublisher,
  getSubscriber,
  publishVariable,
  publishVariables,
  setVariableValuesFromRedis,
} from "../redis.ts";
import { createRedisSource } from "../redis/client.ts";
import type { PlcMqtts } from "../types/mqtt.ts";
import { sendRestRequest } from "../rest.ts";
import { logs } from "../log.ts";
const log = logs.main;

export async function createRedis<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>) {
  const publisher = await getPublisher(config);
  const subscriber = await getSubscriber(config);
  if (isSuccess(publisher) && isSuccess(subscriber)) {
    return { publisher: publisher.output, subscriber: subscriber.output };
  } else {
    // Retry until successful connection
    console.log("Failed to connect to Redis, retrying in 5 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return createRedis(config);
  }
}

export async function createPlc<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>) {
  const plc: Plc<M, S, V> = {
    config,
    runtime: {
      variables: createVariables(config),
      redis: config.redisUrl ? await createRedis(config) : undefined,
      tasks: {},
      mqtt: {},
      sources: {} as PlcSourcesRuntime<S>,
      restSourceIntervals: {} as Record<string, ReturnType<typeof setInterval>>,
    },
  };
  const stopPlc = await startPlc(plc);
  return {
    plc,
    stopPlc: () => {
      stopPlc?.();
    },
  };
}

export function createVariables<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(config: PlcConfig<M, S, V>): PlcVariablesRuntime<M, S, V> {
  const { variables } = config;
  return Object.fromEntries(
    Object.entries(variables).map(([key, variable]) => {
      if (isVariableBoolean(variable)) {
        return [key, { ...variable, value: variable.default, error: null }];
      }
      if (isVariableNumber(variable)) {
        return [key, { ...variable, value: variable.default, error: null }];
      }
      if (isVariableString(variable)) {
        return [key, { ...variable, value: variable.default, error: null }];
      }
      if (isVariableUdt(variable)) {
        return [key, { ...variable, value: variable.default, error: null }];
      }
      throw new Error(`Unknown variable type: ${JSON.stringify(variable)}`);
    })
  ) as PlcVariablesRuntime<M, S, V>;
}

const onFail =
  <M extends PlcMqtts, S extends PlcSources, V extends PlcVariables<M, S>>(
    variables: PlcVariablesRuntime<M, S, V>,
    source: PlcModbusSource
  ) =>
  (error: ReturnType<typeof createModbusErrorProperties>) => {
    Object.values(variables).forEach((variable) => {
      if (variable.source?.id === source.id) {
        variable.source.error = error;
      }
    });
  };

const onConnect =
  <M extends PlcMqtts, S extends PlcSources, V extends PlcVariables<M, S>>(
    variables: PlcVariablesRuntime<M, S, V>,
    source: PlcModbusSource
  ) =>
  () => {
    Object.values(variables).forEach((variable) => {
      if (variable.source?.id === source.id) {
        variable.source.error = null;
      }
    });
  };

const onDisconnect =
  <M extends PlcMqtts, S extends PlcSources, V extends PlcVariables<M, S>>(
    variables: PlcVariablesRuntime<M, S, V>,
    source: PlcModbusSource
  ) =>
  () => {
    Object.values(variables).forEach((variable) => {
      if (variable.source?.id === source.id) {
        variable.source.error = {
          error: "Disconnected",
          message: "Disconnected",
          stack: null,
        };
      }
    });
  };

export async function createSources<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { sources } = plc.config;
  plc.runtime.sources = Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([key, source]) => {
        if (isSourceModbus(source)) {
          return [
            key,
            {
              ...source,
              client: await createModbus(
                source,
                onFail(plc.runtime.variables, source),
                onConnect(plc.runtime.variables, source),
                onDisconnect(plc.runtime.variables, source),
                source.enabled ? "connect" : "disconnect"
              ),
            },
          ];
        }
        if (isSourceOpcua(source)) {
          return [key, { ...source, client: null }];
        }
        if (isSourceRedis(source)) {
          return [key, { ...source, client: await createRedisSource(source) }];
        }
        throw new Error(`Unknown source type: ${JSON.stringify(source)}`);
      })
    )
  );
  const stopSourceIntervals = startSourceIntervals(plc);
  return () => {
    stopSourceIntervals();
  };
}

export function updateRuntimeValue<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>, variableId: keyof PlcVariablesRuntime<M, S, V>, value: number | boolean | string) {
  const variable = plc.runtime.variables[variableId];
  variable.value = value;
  if (plc.runtime.redis?.publisher) {
    publishVariable(plc.runtime.redis.publisher, variable);
  }
  if (hasRedisSource(variable) && variable.source.bidirectional) {
    const source = plc.runtime.sources[variable.source.id];
    if (isSourceRedis(source)) {
      source.client?.publisher?.set(
        variable.source.key,
        variable.source.onSend
          ? variable.source.onSend(value)
          : value.toString()
      );
      source.client?.publisher?.publish(
        variable.source.key,
        variable.source.onSend
          ? variable.source.onSend(value)
          : value.toString()
      );
    }
  }
}

export function updateRuntimeError<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>, variableId: keyof PlcVariablesRuntime<M, S, V>, error: string) {
  plc.runtime.variables[variableId].error = {
    error: "Error",
    message: error,
    stack: null,
    timestamp: new Date(),
  };
}

export function clearRuntimeError<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>, variableId: string) {
  plc.runtime.variables[variableId].error = null;
}

export const getRestRates = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  variables: PlcVariablesRuntime<M, S, V>
) =>
  Object.values(variables)
    .filter((variable) => hasRestSource(variable))
    .reduce((acc: Record<string, PlcVariablesRuntime<M, S, V>>, variable) => {
      if (!acc[`${variable.source.rate}`]) {
        acc[`${variable.source.rate}`] = Object.fromEntries(
          Object.entries(variables).filter(
            ([_, v]) =>
              hasRestSource(v) && v.source.rate === variable.source.rate
          )
        ) as PlcVariablesRuntime<M, S, V>;
      }
      return acc;
    }, {} as Record<string, PlcVariablesRuntime<M, S, V>>);

export function startRestSourceIntervals<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const rates = getRestRates(plc.runtime.variables);
  Object.entries(rates).forEach(([rate, variables]) => {
    const interval = setInterval(async () => {
      for (const [variableId, variable] of Object.entries(variables)) {
        if (hasRestSource(variable)) {
          const result = await sendRestRequest(
            variable.source.url,
            variable.source.method,
            variable.source.headers,
            variable.source.body(variable.value),
            variable.source.timeout
          );
          if (isSuccess(result)) {
            if (variable.source.setFromResponse) {
              const value = variable.source.onResponse
                ? variable.source.onResponse(result.output, variable)
                : result.output;
              updateRuntimeValue(plc, variableId, value);
            }
            clearRuntimeError(plc, variableId);
          } else {
            updateRuntimeError(plc, variableId, result.error);
          }
        }
      }
    }, Number(rate));
    return interval;
  });
  return () => {
    stopRestSourceIntervals(plc);
  };
}

export function startSourceIntervals<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { sources } = plc.runtime;
  Object.values(sources).forEach((source) => {
    const sourceVariables = Object.fromEntries(
      Object.entries(plc.runtime.variables)
        .filter(([_, variable]) => {
          if (hasModbusSource(variable)) {
            return variable.source.id === source.id;
          }
          if (hasOpcuaSource(variable)) {
            return variable.source.id === source.id;
          }
          return false;
        })
        .map(([key, variable]) => [
          key,
          {
            ...variable,
            source: variable.source,
          },
        ])
    ) as PlcVariablesRuntime<M, S, V>;

    if (Object.keys(sourceVariables).length > 0) {
      const rates = Object.values(sourceVariables).reduce(
        (acc: Record<string, PlcVariablesRuntime<M, S, V>>, variable) => {
          if (!acc[`${variable.source.rate}`]) {
            acc[`${variable.source.rate}`] = Object.fromEntries(
              Object.entries(sourceVariables).filter(
                ([_, v]) => variable.source.rate === v.source.rate
              )
            ) as PlcVariablesRuntime<M, S, V>;
          }
          return acc;
        },
        {} as Record<string, PlcVariablesRuntime<M, S, V>>
      );
      if (isSourceModbus(source)) {
        source.intervals = Object.entries(rates).map(([rate, variables]) =>
          setInterval(async () => {
            for (const [variableId, variable] of Object.entries(variables)) {
              if (hasModbusSource(variable)) {
                log.debug(
                  `Modbus interval scanned, client connected is ${source.client?.states.connected}, and source enabled is ${source.enabled}`
                );
                if (source.client?.states.connected && source.enabled) {
                  if (
                    variable.source.bidirectional &&
                    (variable.source.registerType === "COIL" ||
                      variable.source.registerType === "HOLDING_REGISTER")
                  ) {
                    const currentVariable = plc.runtime.variables[variableId];
                    log.debug(
                      `Writing to modbus ${source.id} - ${variableId} = ${currentVariable.value}`
                    );
                    const writeResult = await writeModbus(
                      variable.source.register,
                      variable.source.registerType,
                      variable.source.format,
                      source.client,
                      //@ts-ignore fix type
                      variable.source.onSend
                      //@ts-expect-error TODO: fix type later
                        ? variable.source.onSend(currentVariable.value)
                        : currentVariable.value
                    );
                    if (isFail(writeResult)) {
                      log.warn(
                        `Failed to write to modbus ${source.id} - ${variableId}: ${JSON.stringify(writeResult.message)}`
                      );
                      updateRuntimeError(plc, variableId, writeResult.message || "Unknown error");
                    }
                    clearRuntimeError(plc, variableId);
                  }
                  if (!variable.source.bidirectional) {
                    log.debug(
                      `Reading from modbus ${source.id} - ${variableId}`
                    );
                    const result = await readModbus(
                      variable.source.register,
                      variable.source.registerType,
                      variable.source.format,
                      source.client
                    );
                    if (isSuccess(result)) {
                      const value = variable.source.onResponse
                        ? variable.source.onResponse(result.output)
                        : result.output;
                      updateRuntimeValue(plc, variableId, value);
                      clearRuntimeError(plc, variableId);
                    } else {
                      log.warn(
                        `Failed to read from modbus ${source.id} - ${variableId}: ${result.message}`
                      );
                      updateRuntimeError(
                        plc,
                        variableId,
                        result.message || "Unknown error"
                      );
                      if (result.message?.includes("Port Not Open")) {
                        failModbus(
                          source.client,
                          createModbusErrorProperties(result)
                        );
                      }
                    }
                  }
                }
              }
            }
          }, Number(rate))
        );
      }
    }
  });
  return () => stopSourceIntervals(plc);
}

export function stopSourceIntervals<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { sources } = plc.runtime;
  Object.values(sources).forEach((source) => {
    if (isSourceModbus(source)) {
      source.intervals.forEach((interval) => clearInterval(interval));
    }
  });
  return plc;
}

export function stopRestSourceIntervals<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { restSourceIntervals } = plc.runtime;
  Object.values(restSourceIntervals).forEach((interval) =>
    clearInterval(interval)
  );
  return plc;
}

const getRedisKeyToVariablesMap = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  variables: PlcVariablesRuntime<M, S, V>,
  source: PlcRedisSourceRuntime
) => {
  return Object.entries(variables)
    .filter(([_, variable]) => {
      return hasRedisSource(variable) && variable.source.id === source.id;
    })
    .reduce((acc, [variableId, variable]) => {
      const key = variable.source.key;
      if (!acc[key]) {
        acc[key] = {};
      }
      acc[key][variableId] = variable;
      return acc;
    }, {} as Record<string, Record<string, PlcVariablesRuntime<M, S, V>[string]>>);
};

export function createRedisSourceVariables<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { sources } = plc.runtime;
  for (const source of Object.values(sources)) {
    if (isSourceRedis(source)) {
      const keyToVariablesMap = getRedisKeyToVariablesMap(
        plc.runtime.variables,
        source
      );
      source.client.subscriber.configSet("notify-keyspace-events", "KEA");
      source.client.subscriber.pSubscribe(
        `__keyevent@0__:*`,
        async (...args) => {
          // The eventKey is already the Redis key that was updated
          const redisKey = args[0];
          if (keyToVariablesMap[redisKey]) {
            const value = await source.client.publisher.get(redisKey);

            // Skip processing if value is null
            if (value === null) return;

            for (const [variableId, variable] of Object.entries(
              keyToVariablesMap[redisKey]
            )) {
              // We already filtered by source.id in the map creation
              if (
                isVariableBoolean(variable) &&
                hasRedisSource(variable) &&
                !variable.source.bidirectional
              ) {
                if (variable.source.onResponse) {
                  updateRuntimeValue(
                    plc,
                    variableId,
                    Boolean(variable.source.onResponse(value))
                  );
                } else {
                  updateRuntimeValue(plc, variableId, Boolean(value));
                }
              } else if (
                isVariableNumber(variable) &&
                hasRedisSource(variable)
              ) {
                if (
                  variable.source.onResponse &&
                  !variable.source.bidirectional
                ) {
                  updateRuntimeValue(
                    plc,
                    variableId,
                    variable.source.onResponse(value) as number | boolean
                  );
                } else {
                  updateRuntimeValue(plc, variableId, Number(value));
                }
              } else if (
                isVariableString(variable) &&
                hasRedisSource(variable)
              ) {
                // For string variables, we need to update directly since updateRuntimeValue only accepts number or boolean
                plc.runtime.variables[variableId].value = value;
                if (plc.runtime.redis?.publisher) {
                  publishVariable(
                    plc.runtime.redis.publisher,
                    plc.runtime.variables[variableId]
                  );
                }
              }
            }
          }
        }
      );
    }
  }
}

export const executeTask = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  task: (
  variables: PlcVariablesRuntime<M, S, V>,
  updateVariable: (variableId: keyof PlcVariablesRuntime<M, S, V>, value: number | boolean | string) => void ) => Promise<void> | void,
  variables: PlcVariablesRuntime<M, S, V>,
  updateVariable: (variableId: keyof PlcVariablesRuntime<M, S, V>, value: number | boolean | string) => void
) => rTryAsync(async () => await task(variables, updateVariable));

export function createTasks<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { tasks } = plc.config;
  plc.runtime.tasks = Object.fromEntries(
    Object.entries(tasks).map(([key, task]) => {
      const metrics: PlcTaskRuntime<M, S, V>["metrics"] = {
        wait: {
          start: 0,
          end: 0,
          measurement: 0,
        },
        execute: {
          start: 0,
          end: 0,
          measurement: 0,
        },
      };
      const error: PlcTaskRuntime<M, S, V>["error"] = {
        error: null,
        message: null,
        stack: null,
      };
      return [
        key,
        {
          ...task,
          interval: setInterval(
            async (variables: PlcVariablesRuntime<M, S, V>, updateVariable: (variableId: keyof PlcVariablesRuntime<M, S, V>, value: number | boolean | string) => void) => {
              metrics.wait.end = performance.now();
              metrics.execute.start = performance.now();
              const result = await executeTask(task.program, variables, updateVariable);
              if (isFail(result)) {
                error.error = result.error;
                error.message = result.message;
                error.stack = result.stack;
              }
              updateMetricValues(plc);
              metrics.execute.end = performance.now();
              metrics.execute.measurement =
                metrics.execute.end - metrics.execute.start;
              metrics.wait.measurement = metrics.wait.end - metrics.wait.start;
              metrics.wait.start = performance.now();
              rateLimitedPublish("plcUpdate", plc);
              if (plc.runtime.redis) {
                publishVariables(
                  plc.runtime.redis?.publisher,
                  plc.runtime.variables
                );
              }
            },
            task.scanRate,
            plc.runtime.variables,
            (variableId: keyof typeof plc.runtime.variables, value: number | boolean | string) => {
              updateRuntimeValue(plc, variableId, value);
            }
          ),
          metrics,
          error,
        },
      ];
    })
  );
  return () => destroyTasks(plc);
}

export function destroyTasks<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  Object.values(plc.runtime.tasks).forEach((task) =>
    clearInterval(task.interval)
  );
  return plc;
}

export async function startPlc<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  if (plc.runtime.redis) {
    setVariableValuesFromRedis(
      plc.runtime.redis?.publisher,
      plc.runtime.variables
    );
  }
  const destroySources = await createSources(plc);
  const destroyRestSources = startRestSourceIntervals(plc);
  createRedisSourceVariables(plc);
  let destroyPlcMqtt = createPlcMqtt(plc);
  const mqttRefreshInterval = setInterval(() => {
    destroyPlcMqtt();
    destroyPlcMqtt = createPlcMqtt(plc);
  }, 5 * 60 * 1000);
  const destroyTasks = createTasks(plc);
  return () => {
    destroyRestSources();
    destroySources();
    destroyPlcMqtt();
    destroyTasks();
    clearInterval(mqttRefreshInterval);
  };
}
