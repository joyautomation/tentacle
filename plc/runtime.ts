import { PlcConfig, VariablesRuntime } from "../types.ts";
import { markExecuteEnd, markExecuteStart, markWaitEnd } from "./performance.ts";
import { Plc } from "./types.ts";
import {
  createErrorString,
  createFail,
  createSuccess,
  isFail,
  Result,
} from "@joyautomation/dark-matter";

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
    ])
  );
}

export function rTry<T, U>(fn: (args: U) => T, args: U): Result<T> {
  try {
    return createSuccess(fn(args));
  } catch (e) {
    return createFail(createErrorString(e));
  }
}

export const executeTask = (
  task: (variables: VariablesRuntime) => Promise<void> | void,
  variables: VariablesRuntime
) => rTry(task, variables);

export function createTasks(plc: Plc): PlcTasksRuntime {
  const { tasks } = plc.config;
  const { variables } = plc.runtime;
  Object.entries(tasks).map(([key, task]) => [
    key,
    {
      ...task,
      interval: setInterval(
        async (variables: VariablesRuntime) => {
          markWaitEnd(key);
          markExecuteStart(key);
          const result = await executeTask(task.program, variables);
          if (isFail(result) {
            plc.runtime.tasks[key].error = result.error;
          }
          markExecuteEnd(key);
          
        },
        task.scanRate,
        plc.runtime.variables
      ),
    },
  ]);
}

export function startPlc(plc: Plc) {
  return Promise.resolve(plc);
}

export function stopPlc(plc: Plc) {
  return Promise.resolve(plc);
}
