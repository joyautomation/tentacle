import { pubsub } from "../pubsub.ts";

import { getBuilder } from "@joyautomation/conch";
import {
  Plc,
  PlcConfig,
  PlcTask,
  PlcTaskRuntime,
  PlcVariableRuntime,
  PlcVariables,
} from "../types.ts";
import { flatten } from "@joyautomation/dark-matter";
import { startPlc, stopPlc } from "./runtime.ts";

export function addPlcToSchema<V extends PlcVariables>(
  builder: ReturnType<typeof getBuilder<{ plc: Plc<V> }>>,
) {
  const PlcRef = builder.objectRef<Plc<V>>("Plc");
  const PlcConfigRef = builder.objectRef<PlcConfig<V>>("PlcConfig");
  const PlcVariableRef = builder.objectRef<
    PlcVariableRuntime
  >("PlcVariable");
  const PlcTaskConfigRef = builder.objectRef<PlcTask<V>>("PlcTask");
  const PlcTaskRuntimeRef = builder.objectRef<PlcTaskRuntime<V>>(
    "PlcTaskRuntime",
  );
  const PlcTaskMetricsRef = builder.objectRef<PlcTaskRuntime<V>["metrics"]>(
    "PlcTaskMetrics",
  );
  const PlcTaskErrorRef = builder.objectRef<PlcTaskRuntime<V>["error"]>(
    "PlcTaskError",
  );

  PlcConfigRef.implement({
    fields: (t) => ({
      tasks: t.field({
        type: [PlcTaskConfigRef],
        resolve: (parent) => flatten<PlcTask<V>>(parent.tasks),
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
      id: t.exposeString("name"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      scanRate: t.exposeInt("scanRate"),
      program: t.string({
        resolve: (parent) => parent.program.toString(),
      }),
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
      error: t.string({
        nullable: true,
        resolve: (parent) => parent.error || null,
      }),
      message: t.string({
        nullable: true,
        resolve: (parent) => parent.message || null,
      }),
      stack: t.string({
        nullable: true,
        resolve: (parent) => parent.stack || null,
      }),
    }),
  });
  PlcTaskRuntimeRef.implement({
    fields: (t) => ({
      id: t.exposeString("name"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      scanRate: t.exposeInt("scanRate"),
      program: t.string({
        resolve: (parent) => parent.program.toString(),
      }),
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
        resolve: (parent) =>
          flatten<PlcVariableRuntime>(parent.runtime.variables),
      }),
      tasks: t.field({
        type: [PlcTaskRuntimeRef],
        resolve: (parent) => flatten<PlcTaskRuntime<V>>(parent.runtime.tasks),
      }),
    }),
  });
  builder.queryField("plc", (t) =>
    t.field({
      type: PlcRef,
      resolve: (_, _args, context) => {
        return context.plc;
      },
    }));
  builder.mutationField("restartPlc", (t) =>
    t.field({
      type: PlcRef,
      resolve: async (_, _args, context) => {
        await stopPlc(context.plc);
        await startPlc(context.plc);
        return context.plc;
      },
    }));
  builder.subscriptionField("plc", (t) =>
    t.field({
      type: PlcRef,
      subscribe: () => pubsub.subscribe("plcUpdate"),
      resolve: (payload) => payload,
    }));
}
