import { isSuccess, rTry, rTryAsync } from "@joyautomation/dark-matter";
import type {
  Plc,
  PlcConfig,
  PlcHaRuntime,
  PlcTaskRuntime,
} from "../types/types.ts";
import {
  clearExecuteMeasure,
  clearWaitMeasure,
  markExecuteEnd,
  markExecuteStart,
  markWaitEnd,
  markWaitStart,
  measureExecute,
  measureWait,
} from "./performance.ts";
import { isFail } from "@joyautomation/dark-matter";
import { createPlcMqtt, updateMetricValues } from "../synapse.ts";
import { pubsub } from "../pubsub.ts";
import {
  isSourceModbus,
  isSourceOpcua,
  type PlcModbusSource,
  type PlcSources,
  type PlcSourcesRuntime,
} from "../types/sources.ts";
import {
  hasModbusSource,
  hasOpcuaSource,
  isVariableBoolean,
  isVariableNumber,
  isVariableString,
  isVariableUdt,
  type PlcVariables,
  type PlcVariablesRuntime,
} from "../types/variables.ts";
import {
  type createModbusErrorProperties,
  createModbus,
  readModbus,
} from "../modbus/client.ts";
import { addLeadershipListener, initializeLease } from "../lease/lease.ts";
import { customAlphabet } from "nanoid";
import {
  getPublisher,
  getSubscriber,
  publishVariable,
  publishVariables,
  setVariableValuesFromRedis,
} from "../redis.ts";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

export function isLeader<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
): boolean {
  return plc.runtime.ha?.state.isLeader ?? true;
}

export async function createRedis<
  S extends PlcSources,
  V extends PlcVariables<S>
>(config: PlcConfig<S, V>) {
  const publisher = await getPublisher(config);
  const subscriber = await getSubscriber(config);
  if (isSuccess(publisher) && isSuccess(subscriber)) {
    return { publisher: publisher.output, subscriber: subscriber.output };
  }
  return undefined;
}

export async function createPlc<
  S extends PlcSources,
  V extends PlcVariables<S>
>(config: PlcConfig<S, V>) {
  const plc: Plc<S, V> = {
    config,
    runtime: {
      ha: createHaRuntime(config),
      variables: createVariables(config),
      redis: config.redisUrl ? await createRedis(config) : undefined,
      tasks: {},
      mqtt: {},
      sources: {} as PlcSourcesRuntime<S>,
    },
  };
  let stopPlc: () => void;
  if (plc.runtime.ha?.state) {
    addLeadershipListener(plc.runtime.ha.state, "onLeader", async () => {
      stopPlc = await startPlc(plc);
    });
    addLeadershipListener(plc.runtime.ha?.state, "onLeaderLoss", () => {
      stopPlc?.();
    });
  } else {
    stopPlc = await startPlc(plc);
  }
  return {
    plc,
    stopPlc: () => {
      stopPlc?.();
    },
  };
}

export function createHaRuntime<
  V extends PlcVariables<S>,
  S extends PlcSources
>(config: PlcConfig<S, V>): PlcHaRuntime | undefined {
  if (!config.ha) {
    return undefined;
  }

  const state = initializeLease({
    ...config.ha,
    identity: `tentacle-${nanoid(7)}`,
  });

  return { ...config.ha, state };
}

export function createVariables<
  S extends PlcSources,
  V extends PlcVariables<S>
>(config: PlcConfig<S, V>): PlcVariablesRuntime<S, V> {
  const { variables } = config;
  return Object.fromEntries(
    Object.entries(variables).map(([key, variable]) => {
      if (isVariableBoolean(variable)) {
        return [key, { ...variable, value: variable.default }];
      }
      if (isVariableNumber(variable)) {
        return [key, { ...variable, value: variable.default }];
      }
      if (isVariableString(variable)) {
        return [key, { ...variable, value: variable.default }];
      }
      if (isVariableUdt(variable)) {
        return [key, { ...variable, value: variable.default }];
      }
      throw new Error(`Unknown variable type: ${JSON.stringify(variable)}`);
    })
  ) as PlcVariablesRuntime<S, V>;
}

const onFail =
  <S extends PlcSources, V extends PlcVariables<S>>(
    variables: PlcVariablesRuntime<S, V>,
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
  <S extends PlcSources, V extends PlcVariables<S>>(
    variables: PlcVariablesRuntime<S, V>,
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
  <S extends PlcSources, V extends PlcVariables<S>>(
    variables: PlcVariablesRuntime<S, V>,
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
  S extends PlcSources,
  V extends PlcVariables<S>
>(plc: Plc<S, V>) {
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
                onDisconnect(plc.runtime.variables, source)
              ),
            },
          ];
        }
        if (isSourceOpcua(source)) {
          return [key, { ...source, client: null }];
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
  S extends PlcSources,
  V extends PlcVariables<S>
>(plc: Plc<S, V>, variableId: string, value: number | boolean) {
  plc.runtime.variables[variableId].value = value;
  if (plc.runtime.redis?.publisher) {
    publishVariable(
      plc.runtime.redis.publisher,
      plc.runtime.variables[variableId]
    );
  }
}

export function startSourceIntervals<
  S extends PlcSources,
  V extends PlcVariables<S>
>(plc: Plc<S, V>) {
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
    ) as PlcVariablesRuntime<S, V>;

    if (Object.keys(sourceVariables).length > 0) {
      const rates = Object.values(sourceVariables).reduce(
        (acc: Record<string, PlcVariablesRuntime<S, V>>, variable) => {
          if (!acc[`${variable.source.rate}`]) {
            acc[`${variable.source.rate}`] = Object.fromEntries(
              Object.entries(sourceVariables).filter(
                ([_, variable]) => variable.source.rate === variable.source.rate
              )
            ) as PlcVariablesRuntime<S, V>;
          }
          return acc;
        },
        {} as Record<string, PlcVariablesRuntime<S, V>>
      );
      source.intervals = Object.entries(rates).map(([rate, variables]) =>
        setInterval(async () => {
          if (isLeader(plc) && source.client?.states.connected) {
            const result = await Promise.all(
              Object.entries(variables).map(([_, variable]) =>
                readModbus(
                  variable.source.register,
                  variable.source.registerType,
                  variable.source.format,
                  source.client
                ).then((result) => ({
                  result,
                  variable: variable.id,
                }))
              )
            );
            result.forEach(({ result, variable }) => {
              // TODO: Probably worth doing a check to make sure the right types are being set.
              if (isSuccess<number | boolean>(result)) {
                updateRuntimeValue(plc, variable, result.output);
              }
            });
          }
        }, Number(rate))
      );
    }
  });
  return () => stopSourceIntervals(plc);
}

export function stopSourceIntervals<
  S extends PlcSources,
  V extends PlcVariables<S>
>(plc: Plc<S, V>) {
  const { sources } = plc.runtime;
  Object.values(sources).forEach((source) => {
    source.intervals.forEach((interval) => clearInterval(interval));
  });
  return plc;
}

export const executeTask = <V extends PlcVariables<S>, S extends PlcSources>(
  task: (variables: PlcVariablesRuntime<S, V>) => Promise<void> | void,
  variables: PlcVariablesRuntime<S, V>
) => rTryAsync(async () => await task(variables));

export function createTasks<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
) {
  const { tasks } = plc.config;
  plc.runtime.tasks = Object.fromEntries(
    Object.entries(tasks).map(([key, task]) => {
      const metrics: PlcTaskRuntime<S, V>["metrics"] = {
        waitTime: 0,
        executeTime: 0,
      };
      const error: PlcTaskRuntime<S, V>["error"] = {
        error: null,
        message: null,
        stack: null,
      };
      return [
        key,
        {
          ...task,
          interval: setInterval(
            async (variables: PlcVariablesRuntime<S, V>) => {
              if (isLeader(plc)) {
                markWaitEnd(key);
                markExecuteStart(key);
                const result = await executeTask(task.program, variables);
                if (isFail(result)) {
                  error.error = result.error;
                  error.message = result.message;
                  error.stack = result.stack;
                }
                updateMetricValues(plc);
                markExecuteEnd(key);
                const measureResult = rTry(() => {
                  clearWaitMeasure(key);
                  measureWait(key);
                  metrics.waitTime =
                    performance
                      .getEntriesByType("measure")
                      .find((measure) => measure.name === `${key}-wait`)
                      ?.duration || 0;
                });
                if (isFail(measureResult)) {
                  if (
                    measureResult.message !==
                    'Cannot find mark: "main-wait-start".'
                  ) {
                    // log.error(JSON.stringify(measureResult));
                  }
                }
                markWaitStart(key);
                clearExecuteMeasure(key);
                measureExecute(key);
                metrics.executeTime =
                  performance
                    .getEntriesByType("measure")
                    .find((measure) => measure.name === `${key}-execute`)
                    ?.duration || 0;
                pubsub.publish("plcUpdate", plc);
                if (plc.runtime.redis) {
                  publishVariables(
                    plc.runtime.redis?.publisher,
                    plc.runtime.variables
                  );
                }
              }
            },
            task.scanRate,
            plc.runtime.variables
          ),
          metrics,
          error,
        },
      ];
    })
  );
  return () => destroyTasks(plc);
}

export function destroyTasks<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
) {
  Object.values(plc.runtime.tasks).forEach((task) =>
    clearInterval(task.interval)
  );
  return plc;
}

export async function startPlc<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
) {
  if (plc.runtime.redis) {
    setVariableValuesFromRedis(
      plc.runtime.redis?.publisher,
      plc.runtime.variables
    );
  }
  const destroySources = await createSources(plc);
  const destroyPlcMqtt = createPlcMqtt(plc);
  const destroyTasks = createTasks(plc);
  return () => {
    destroySources();
    destroyPlcMqtt();
    destroyTasks();
  };
}
