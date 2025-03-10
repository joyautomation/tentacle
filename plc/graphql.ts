import { pubsub } from "../pubsub.ts";

import { getBuilder } from "@joyautomation/conch";
import { Plc, PlcConfig, PlcTask, PlcTaskRuntime } from "../types/types.ts";
import { flatten } from "@joyautomation/dark-matter";
import { startPlc, stopPlc } from "./runtime.ts";
import {
  PlcVariable,
  PlcVariableRuntime,
  PlcVariables,
} from "../types/variables.ts";
import { PlcSources } from "../types/sources.ts";

export function addPlcToSchema<V extends PlcVariables, S extends PlcSources>(
  builder: ReturnType<typeof getBuilder<{ plc: Plc<V, S> }>>
) {
  const PlcRef = builder.objectRef<Plc<V, S>>("Plc");
  const PlcConfigRef = builder.objectRef<PlcConfig<V, S>>("PlcConfig");
  const PlcConfigTaskRef = builder.objectRef<PlcTask<V, S>>("PlcTask");
  const PlcConfigVariableRef = builder.objectRef<PlcVariable<S>>("PlcVariable");

  const PlcRuntimeRef = builder.objectRef<Plc<V, S>["runtime"]>("PlcRuntime");
  const PlcRuntimeTaskRef =
    builder.objectRef<PlcTaskRuntime<V, S>>("PlcTaskRuntime");
  const PlcRuntimeTaskMetricsRef =
    builder.objectRef<PlcTaskRuntime<V, S>["metrics"]>("PlcTaskMetrics");
  const PlcRuntimeTaskErrorRef =
    builder.objectRef<PlcTaskRuntime<V, S>["error"]>("PlcTaskError");
  const PlcRuntimeVariableRef =
    builder.objectRef<PlcVariableRuntime<S>>("PlcVariableRuntime");
  const PlcRuntimeMqttRef =
    builder.objectRef<Plc<V, S>["runtime"]["mqtt"]>("PlcMqttRuntime");
  const PlcRuntimeSourcesRef =
    builder.objectRef<Plc<V, S>["runtime"]["sources"]>("PlcSourceRuntime");

  PlcConfigRef.implement({
    fields: (t) => ({
      tasks: t.field({
        type: [PlcConfigTaskRef],
        resolve: (parent) => flatten<PlcTask<V>>(parent.tasks),
      }),
    }),
  });
  PlcConfigVariableRef.implement({
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
  PlcRuntimeVariableRef.implement({
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
  PlcConfigTaskRef.implement({
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
  PlcRuntimeTaskErrorRef.implement({
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
  PlcRuntimeTaskRef.implement({
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
        type: PlcRuntimeTaskMetricsRef,
        resolve: (parent) => parent.metrics,
      }),
      error: t.field({
        type: PlcRuntimeTaskErrorRef,
        resolve: (parent) => parent.error,
      }),
    }),
  });
  PlcRuntimeRef.implement({
    fields: (t) => ({
      tasks: t.field({
        type: [PlcRuntimeTaskRef],
        resolve: (parent) => flatten<PlcTaskRuntime<V, S>>(parent.tasks),
      }),
      variables: t.field({
        type: [PlcRuntimeVariableRef],
        resolve: (parent) =>
          flatten<PlcVariableRuntime<S, V>>(parent.variables),
      }),
      mqtt: t.field({
        type: PlcRuntimeMqttRef,
        resolve: (parent) => parent.mqtt,
      }),
      sources: t.field({
        type: PlcRuntimeSourcesRef,
        resolve: (parent) => parent.sources,
      }),
    }),
  });
  PlcRef.implement({
    fields: (t) => ({
      runtime: t.field({
        type: PlcRuntimeRef,
        resolve: (parent) => parent.runtime,
      }),
      config: t.field({
        type: PlcConfigRef,
        resolve: (parent) => parent.config,
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
