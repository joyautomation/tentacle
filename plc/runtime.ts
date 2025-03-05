import type { PlcConfig, PlcTaskRuntime, Variable } from "../types.ts";
import { copy, existsSync } from "@std/fs";
import { join } from "@std/path";
import { logs } from "../log.ts";
import { validate } from "./validation.ts";
import { failure, Result, success } from "../utils/result.ts";
import { Plc } from "./types.ts";
import { importFresh } from "../utils/importFresh.ts";
import { PlcTask } from "../types.ts";
import {
  clearExecuteMeasure,
  clearWaitMeasure,
  markExecuteEnd,
  markExecuteStart,
  markWaitEnd,
} from "./performance.ts";
import { measureWait } from "./performance.ts";
import { markWaitStart } from "./performance.ts";
import { measureExecute } from "./performance.ts";
import { getBuilder } from "@joyautomation/conch";
import { flatten } from "../utils/flatten.ts";
import { createPlcMqtt, updateMetricValues } from "../synapse.ts";
import { pubsub } from "../pubsub.ts";
import { disconnectNode } from "@joyautomation/synapse";

const { main: log } = logs;

export const _internals = {
  copy,
  existsSync,
  importFresh,
};

export async function createDefaultFiles() {
  const defaultConfig = {
    tasks: {
      main: {
        description: "The main task",
        scanRate: 2500,
        program: "main",
      },
    },
    mqtt: {},
    modbus: {},
    opcua: {},
  };
  32;
  const defaultVariables: { [key: string]: Variable } = {
    count: {
      id: "count",
      datatype: "number",
      description: "A counter",
      default: 0,
      persistent: true,
    },
  };
  const mainProgram = `export function main(
  variables: { [key: string]: boolean | number | string | null },
) {
  variables.count = variables?.count || 0 + 1;
}`;
  const files = [
    {
      path: "variables.ts",
      content: `import { variables as defaultVariables } from "./variables/default.ts";
export const variables = {...defaultVariables}`,
    },
    {
      path: "variables/default.ts",
      content: `export const variables = ${JSON.stringify(
        defaultVariables,
        null,
        2
      )}`,
    },
    {
      path: "program/main.ts",
      content: mainProgram,
    },
    {
      path: "config.ts",
      content: `export const config = ${JSON.stringify(
        defaultConfig,
        null,
        2
      )}`,
    },
  ];
  await Promise.all(
    files.map((file) => {
      const path = join(Deno.cwd(), "development", file.path);
      const pathDir = path.substring(0, path.lastIndexOf("/"));
      Deno.mkdirSync(pathDir, { recursive: true });
      return Deno.writeTextFile(path, file.content, { createNew: true }).catch(
        (error) => {
          if (error.name === "AlreadyExists") {
            log.info(`${path} already exists`);
          } else {
            log.error(`Error creating ${path}: ${error.trace}`);
          }
        }
      );
    })
  );
}

export async function updateRuntime(): Promise<Result<void, string>> {
  const result = await validate("development");
  if (!result.success) {
    return failure(result.error);
  }
  log.info("Development files are valid. Updating runtime...");
  await _internals.copy(
    join(Deno.cwd(), "development"),
    join(Deno.cwd(), "runtime"),
    {
      overwrite: true,
    }
  );
  log.info("Runtime updated.");
  return success();
}

export async function getRuntimeConfig(): Promise<Result<Plc, string>> {
  const result = await validate("runtime");
  if (!result.success) return failure(result.error);
  log.info("Runtime is valid.");
  const { config } = await importFresh<{ config: PlcConfig }>(
    join(Deno.cwd(), "runtime", "config.ts")
  );
  const { variables } = await importFresh<{
    variables: Record<string, Variable>;
  }>(join(Deno.cwd(), "runtime", "variables.ts"));
  return success({
    config,
    variables: await createVariables(variables),
    tasks: {},
    mqtt: {},
  });
}

function getPlcSummary(plc: Plc) {
  const keys = Object.keys(plc.config);
  const configCounts = keys.reduce((acc, key) => {
    if (key in plc.config) {
      acc[key] = Object.keys(plc.config[key as keyof PlcConfig]).length;
    }
    return acc;
  }, {} as Record<string, number>);
  const summary = {
    ...configCounts,
    variables: Object.keys(plc.variables).length,
  };
  return `${Object.entries(summary)
    .map(([key, value], index, array) => {
      const singularKey = value === 1 ? key.replace(/s$/, "") : key;
      return index === array.length - 1
        ? `and ${value} ${singularKey}`
        : `${value} ${singularKey}`;
    })
    .join(", ")}`;
}

async function createTasks(plc: Plc): Promise<Plc> {
  const resultTasks: [string, PlcTaskRuntime][] = [];
  for (const [key, task] of Object.entries(plc.config.tasks)) {
    const { program, scanRate } = task;
    const programPath = join(Deno.cwd(), "runtime", "program", `${program}.ts`);
    const programModule = await importFresh<{
      main: ({
        v,
      }: {
        v: Record<
          string,
          Variable & { value: boolean | number | string | null }
        >;
      }) => void;
    }>(programPath);
    const { main } = programModule;
    const metrics = {
      waitTime: 0,
      executeTime: 0,
    };
    const taskError: PlcTaskRuntime["error"] = {
      message: null,
      stack: null,
    };
    const interval = setInterval(
      ({ v }) => {
        markWaitEnd(key);
        markExecuteStart(key);
        try {
          main(v);
        } catch (error) {
          log.error(`Task ${key} threw an error: ${error.stack}`);
          taskError.message = error.message;
          taskError.stack = error.stack;
        }
        updateMetricValues(plc);
        markExecuteEnd(key);
        try {
          clearWaitMeasure(key);
          measureWait(key);
          metrics.waitTime =
            performance
              .getEntriesByType("measure")
              .find((measure) => measure.name === `${key}-wait`)?.duration || 0;
        } catch (error) {
          if (error.message !== 'Cannot find mark: "main-wait-start".') {
            log.error(error);
          }
        }
        markWaitStart(key);
        clearExecuteMeasure(key);
        measureExecute(key);
        metrics.executeTime =
          performance
            .getEntriesByType("measure")
            .find((measure) => measure.name === `${key}-execute`)?.duration ||
          0;
        pubsub.publish("plcUpdate", plc);
      },
      scanRate,
      {
        v: plc.variables,
      }
    );
    resultTasks.push([
      key,
      {
        ...task,
        name: key,
        interval,
        metrics,
        error: taskError,
      },
    ]);
  }
  plc.tasks = Object.fromEntries(resultTasks);
  return plc;
}

function createVariables(
  variables: Record<string, Variable>
): Record<string, Variable & { value: boolean | number | string | null }> {
  const resultVariables: [
    string,
    Variable & { value: boolean | number | string | null }
  ][] = [];
  for (const [key, variable] of Object.entries(variables)) {
    let value: boolean | number | string | null = variable.default || null;
    resultVariables.push([key, { ...variable, value }]);
  }
  return Object.fromEntries(resultVariables);
}

export function createPlc(): Promise<Plc> {
  const plc: Plc = {
    config: {
      tasks: {},
      mqtt: {},
      modbus: {},
      opcua: {},
    },
    tasks: {},
    variables: {},
    mqtt: {},
  };
  createDefaultFiles();
  return startPlc(plc);
}

export const startPlc = async (plc: Plc) => {
  const result = await updateRuntime();
  if (!result.success) {
    log.warn(
      `Runtime was not updated: ${result.error}. Using existing runtime...`
    );
  }
  const runtime = await getRuntimeConfig().then((result) => {
    if (!result.success) throw new Error(result.error);
    log.info(`Plc started with ${getPlcSummary(result.value)}.`);
    return result.value;
  });
  plc.config = runtime.config;
  plc.variables = runtime.variables;
  createPlcMqtt(plc);
  return createTasks(plc);
};

export const stopPlc = (plc: Plc) => {
  Object.values(plc.tasks).forEach((task) => clearInterval(task.interval));
  Object.values(plc.mqtt).forEach((mqtt) => {
    disconnectNode(mqtt);
  });
  log.info("Plc stopped.");
};

export function addPlcToSchema(
  builder: ReturnType<typeof getBuilder<{ plc: Plc }>>
) {
  const PlcRef = builder.objectRef<Plc>("Plc");
  const PlcConfigRef = builder.objectRef<PlcConfig>("PlcConfig");
  const PlcVariableRef = builder.objectRef<
    Variable & { value: boolean | number | string | null }
  >("PlcVariable");
  const PlcTaskConfigRef = builder.objectRef<PlcTask>("PlcTask");
  const PlcTaskRuntimeRef = builder.objectRef<PlcTaskRuntime>("PlcTaskRuntime");
  const PlcTaskMetricsRef =
    builder.objectRef<PlcTaskRuntime["metrics"]>("PlcTaskMetrics");
  const PlcTaskErrorRef =
    builder.objectRef<PlcTaskRuntime["error"]>("PlcTaskError");

  PlcConfigRef.implement({
    fields: (t) => ({
      tasks: t.field({
        type: [PlcTaskConfigRef],
        resolve: (parent) => flatten(parent.tasks),
      }),
    }),
  });
  PlcVariableRef.implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      datatype: t.exposeString("datatype"),
      description: t.exposeString("description"),
      default: t.string({
        resolve: (parent) => parent.default?.toString(),
      }),
      persistent: t.exposeBoolean("persistent"),
      value: t.string({
        resolve: (parent) => parent.value?.toString(),
      }),
    }),
  });
  PlcTaskConfigRef.implement({
    fields: (t) => ({
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      scanRate: t.exposeInt("scanRate"),
      program: t.exposeString("program"),
    }),
  });
  PlcTaskMetricsRef.implement({
    fields: (t) => ({
      waitTime: t.exposeFloat("waitTime"),
      executeTime: t.exposeFloat("executeTime"),
    }),
  });
  PlcTaskErrorRef.implement({
    fields: (t) => ({
      message: t.exposeString("message"),
      stack: t.exposeString("stack"),
    }),
  });
  PlcTaskRuntimeRef.implement({
    fields: (t) => ({
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      scanRate: t.exposeInt("scanRate"),
      program: t.exposeString("program"),
      interval: t.exposeInt("interval"),
      metrics: t.field({
        type: PlcTaskMetricsRef,
        resolve: (parent) => parent.metrics,
      }),
      error: t.field({
        type: PlcTaskErrorRef,
        resolve: (parent) => parent.error,
      }),
    }),
  });
  PlcRef.implement({
    fields: (t) => ({
      config: t.field({
        type: PlcConfigRef,
        resolve: (parent) => parent.config,
      }),
      variables: t.field({
        type: [PlcVariableRef],
        resolve: (parent) => flatten(parent.variables),
      }),
      tasks: t.field({
        type: [PlcTaskRuntimeRef],
        resolve: (parent) => flatten(parent.tasks),
      }),
    }),
  });
  builder.queryField("plc", (t) =>
    t.field({
      type: PlcRef,
      resolve: (_, _args, context) => {
        return context.plc;
      },
    })
  );
  builder.mutationField("restartPlc", (t) =>
    t.field({
      type: PlcRef,
      resolve: async (_, _args, context) => {
        await stopPlc(context.plc);
        await startPlc(context.plc);
        return context.plc;
      },
    })
  );
  builder.subscriptionField("plc", (t) =>
    t.field({
      type: PlcRef,
      subscribe: () => pubsub.subscribe("plcUpdate"),
      resolve: (payload) => payload,
    })
  );
}
