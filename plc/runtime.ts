import { rTryAsync } from "https://jsr.io/@joyautomation/dark-matter/0.0.21/result/error.ts";
import {
  PlcConfig,
  PlcTaskRuntime,
  PlcTasksRuntime,
  PlcTasksRuntime,
  VariablesRuntime,
} from "../types.ts";
import {
  clearWaitMeasure,
  clearWaitMeasure,
  markExecuteEnd,
  markExecuteStart,
  markWaitEnd,
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

export function rTry<T, U>(
  fn: (args: U) => T | Promise<T>,
  args: U,
): Result<T> {
  try {
    return createSuccess(fn(args));
  } catch (e) {
    return createFail(createErrorString(e));
  }
}

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
  task: (variables: VariablesRuntime) => Promise<void>,
  variables: VariablesRuntime,
) => rTryAsync(() => task(variables));

export function createTasks(plc: Plc) {
  const { tasks } = plc.config;
  const { variables } = plc.runtime;
  plc.runtime.tasks = Object.fromEntries(
    Object.entries(tasks).map(([key, task]) => {
      plc.runtime.tasks[key].metrics = {
        waitTime: 0,
        executeTime: 0,
      };
      plc.runtime.tasks[key].error = {
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
                plc.runtime.tasks[key].error = {
                  error: result.error,
                  message: result.message,
                  stack: result.stack,
                };
              }
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
            },
            task.scanRate,
            plc.runtime.variables,
          ),
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
