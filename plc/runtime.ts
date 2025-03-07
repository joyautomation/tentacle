import { rTry, rTryAsync } from "@joyautomation/dark-matter";
import { PlcConfig, PlcTaskRuntime, VariablesRuntime } from "../types.ts";
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
import { Plc } from "./types.ts";
import {
  createErrorString,
  createFail,
  createSuccess,
  isFail,
  Result,
} from "@joyautomation/dark-matter";
import { logs } from "../log.ts";
const { main: log } = logs;

export function createPlc(config: PlcConfig): Promise<Plc> {
  const plc: Plc = {
    config,
    runtime: {
      variables: createVariables(config),
      tasks: {},
    },
  };
  createTasks(plc);
  return startPlc(plc);
}

export function createVariables(config: PlcConfig): VariablesRuntime {
  const { variables } = config;
  return Object.fromEntries(
    Object.entries(variables).map(([key, variable]) => [
      key,
      {
        ...variable,
        value: variable.default || null,
      },
    ]),
  );
}

export const executeTask = (
  task: (variables: VariablesRuntime) => Promise<void> | void,
  variables: VariablesRuntime,
) => rTryAsync(async () => await task(variables));

export function createTasks(plc: Plc) {
  const { tasks } = plc.config;
  plc.runtime.tasks = Object.fromEntries(
    Object.entries(tasks).map(([key, task]) => {
      const metrics: PlcTaskRuntime["metrics"] = {
        waitTime: 0,
        executeTime: 0,
      };
      const error: PlcTaskRuntime["error"] = {
        error: null,
        message: null,
        stack: null,
      };
      return [
        key,
        {
          ...task,
          interval: setInterval(
            async (variables: VariablesRuntime) => {
              markWaitEnd(key);
              markExecuteStart(key);
              const result = await executeTask(task.program, variables);
              if (isFail(result)) {
                error.error = result.error;
                error.message = result.message;
                error.stack = result.stack;
              }
              // updateMetricValues(plc);
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
                  log.error(JSON.stringify(measureResult));
                }
              }
              markWaitStart(key);
              clearExecuteMeasure(key);
              measureExecute(key);
              metrics.executeTime = performance
                .getEntriesByType("measure")
                .find((measure) => measure.name === `${key}-execute`)
                ?.duration || 0;
              // pubsub.publish("plcUpdate", plc);
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
}

export function startPlc(plc: Plc) {
  return Promise.resolve(plc);
}

export function stopPlc(plc: Plc) {
  return Promise.resolve(plc);
}
