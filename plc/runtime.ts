import { rTry, rTryAsync } from "@joyautomation/dark-matter";
import {
  isVariableBoolean,
  isVariableNumber,
  isVariableString,
  isVariableUdt,
  Plc,
  PlcConfig,
  PlcTaskRuntime,
  PlcVariables,
  PlcVariablesRuntime,
} from "../types.ts";
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

export function createPlc<V extends PlcVariables>(
  config: PlcConfig<V>,
) {
  const plc: Plc<V> = {
    config,
    runtime: {
      variables: createVariables(config),
      tasks: {},
      mqtt: {},
    },
  };
  return startPlc(plc);
}

export function createVariables<V extends PlcVariables>(
  config: PlcConfig<V>,
): PlcVariablesRuntime<V> {
  const { variables } = config;
  return Object.fromEntries(
    Object.entries(variables).map(([key, variable]) => {
      if (isVariableBoolean(variable)) {
        return [
          key,
          { ...variable, value: variable.default },
        ];
      }
      if (isVariableNumber(variable)) {
        return [
          key,
          { ...variable, value: variable.default },
        ];
      }
      if (isVariableString(variable)) {
        return [
          key,
          { ...variable, value: variable.default },
        ];
      }
      if (isVariableUdt(variable)) {
        return [
          key,
          { ...variable, value: variable.default },
        ];
      }
      throw new Error(`Unknown variable type: ${JSON.stringify(variable)}`);
    }),
  ) as PlcVariablesRuntime<V>;
}

export const executeTask = <V extends PlcVariables>(
  task: (variables: PlcVariablesRuntime<V>) => Promise<void> | void,
  variables: PlcVariablesRuntime<V>,
) => rTryAsync(async () => await task(variables));

export function createTasks<V extends PlcVariables>(plc: Plc<V>) {
  const { tasks } = plc.config;
  plc.runtime.tasks = Object.fromEntries(
    Object.entries(tasks).map(([key, task]) => {
      const metrics: PlcTaskRuntime<V>["metrics"] = {
        waitTime: 0,
        executeTime: 0,
      };
      const error: PlcTaskRuntime<V>["error"] = {
        error: null,
        message: null,
        stack: null,
      };
      return [
        key,
        {
          ...task,
          interval: setInterval(
            async (variables: PlcVariablesRuntime<V>) => {
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
                plc.runtime.tasks[key].metrics.waitTime = performance
                  .getEntriesByType("measure")
                  .find((measure) => measure.name === `${key}-wait`)
                  ?.duration ||
                  0;
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
              metrics.executeTime = performance
                .getEntriesByType("measure")
                .find((measure) => measure.name === `${key}-execute`)
                ?.duration || 0;
              pubsub.publish("plcUpdate", plc);
            },
            task.scanRate,
            plc.runtime.variables,
          ),
          metrics,
          error,
        },
      ];
    }),
  );
  return plc;
}

export function startPlc<V extends PlcVariables>(plc: Plc<V>) {
  createPlcMqtt(plc);
  return createTasks(plc);
}

export function stopPlc<V extends PlcVariables>(plc: Plc<V>) {
  return Promise.resolve(plc);
}
