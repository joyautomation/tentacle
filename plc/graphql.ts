import { pubsub } from "../pubsub.ts";

import type { getBuilder } from "@joyautomation/conch";
import type {
  MqttConnection,
  Plc,
  PlcConfig,
  PlcTask,
  PlcTaskRuntime,
} from "../types/types.ts";
import { flatten } from "@joyautomation/dark-matter";
import type {
  PlcVariable,
  PlcVariableRuntime,
  PlcVariables,
} from "../types/variables.ts";
import {
  isSourceModbus,
  isSourceOpcua,
  isVariableModbusSourceRuntime,
  isVariableOpcuaSourceRuntime,
  type PlcSource,
  type PlcSourceRuntime,
  type PlcSources,
  type PlcVariableModbusSourceRuntime,
  type PlcVariableOpcuaSourceRuntime,
} from "../types/sources.ts";
import {
  type createNode,
  getNodeStateString,
  type SparkplugNode,
} from "@joyautomation/synapse";
import { GraphQLError } from "graphql";
import { getModbusStateString } from "../modbus/client.ts";
// import { getModbusStateString } from "../modbus/client.ts";

export function addPlcToSchema<S extends PlcSources, V extends PlcVariables<S>>(
  builder: ReturnType<typeof getBuilder<{ plc: Plc<S, V> }>>,
) {
  const PlcRef = builder.objectRef<Plc<S, V>>("Plc");
  const PlcConfigRef = builder.objectRef<PlcConfig<S, V>>("PlcConfig");
  const PlcConfigTaskRef = builder.objectRef<PlcTask<S, V>>("PlcTask");
  const PlcConfigVariableRef = builder.objectRef<PlcVariable<S>>("PlcVariable");
  const PlcConfigMqttRef = builder.objectRef<MqttConnection>("PlcMqttConfig");
  const PlcConfigSourcesRef = builder.objectRef<PlcSource>("PlcSourcesConfig");

  const PlcRuntimeRef = builder.objectRef<Plc<S, V>["runtime"]>("PlcRuntime");
  const PlcRuntimeTaskRef = builder.objectRef<PlcTaskRuntime<S, V>>(
    "PlcTaskRuntime",
  );
  const PlcRuntimeTaskMetricsRef = builder.objectRef<
    PlcTaskRuntime<S, V>["metrics"]
  >("PlcTaskMetrics");
  const PlcRuntimeTaskErrorRef = builder.objectRef<
    PlcTaskRuntime<S, V>["error"]
  >("PlcTaskError");
  const PlcRuntimeVariableRef = builder.objectRef<PlcVariableRuntime<S>>(
    "PlcVariableRuntime",
  );
  const PlcRuntimeVariableModbusSourceRef = builder.objectRef<
    PlcVariableModbusSourceRuntime<S>
  >("PlcVariableModbusSourceRuntime");
  const PlcRuntimeVariableOpcuaSourceRef = builder.objectRef<
    PlcVariableOpcuaSourceRuntime<S>
  >("PlcVariableOpcuaSourceRuntime");
  const PlcRuntimeVariableErrorRef = builder.objectRef<{
    error: string | null;
    message?: string | null;
    stack?: string | null;
  }>("PlcVariableError");

  PlcRuntimeVariableErrorRef.implement({
    fields: (t) => ({
      error: t.string({
        nullable: true,
        resolve: (parent) => parent.error,
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

  const PlcRuntimeMqttRef = builder.objectRef<SparkplugNode>("PlcMqttRuntime");
  const PlcRuntimeSourceRef = builder.objectRef<PlcSourceRuntime>(
    "PlcSourceRuntime",
  );

  const PlcRuntimeVariableSourceRef = builder.unionType(
    "PlcVariableSourceRuntime",
    {
      types: [
        PlcRuntimeVariableModbusSourceRef,
        PlcRuntimeVariableOpcuaSourceRef,
      ],
      resolveType: (source) => {
        if (isSourceModbus(source)) {
          return "PlcVariableModbusSourceRuntime";
        }
        if (isSourceOpcua(source)) {
          return "PlcVariableOpcuaSourceRuntime";
        }
        return undefined;
      },
    },
  );

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
  PlcConfigVariableRef.implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      datatype: t.exposeString("datatype"),
      description: t.exposeString("description"),
      default: t.string({
        resolve: (parent) => parent.default?.toString(),
      }),
    }),
  });
  PlcConfigMqttRef.implement({
    fields: (t) => ({
      enabled: t.exposeBoolean("enabled"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      serverUrl: t.exposeString("serverUrl"),
      groupId: t.exposeString("groupId"),
      nodeId: t.exposeString("nodeId"),
      deviceId: t.exposeString("deviceId"),
      clientId: t.exposeString("clientId"),
      username: t.exposeString("username"),
      password: t.exposeString("password"),
      version: t.exposeString("version"),
    }),
  });
  PlcConfigSourcesRef.implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      enabled: t.exposeBoolean("enabled"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      host: t.exposeString("host"),
      port: t.exposeInt("port"),
      retryMinDelay: t.exposeInt("retryMinDelay"),
      retryMaxDelay: t.exposeInt("retryMaxDelay"),
    }),
  });
  PlcConfigRef.implement({
    fields: (t) => ({
      tasks: t.field({
        type: [PlcConfigTaskRef],
        resolve: (parent) => flatten<PlcTask<S, V>>(parent.tasks),
      }),
      variables: t.field({
        type: [PlcConfigVariableRef],
        resolve: (parent) => flatten<PlcVariable<S>>(parent.variables),
      }),
      mqtt: t.field({
        type: [PlcConfigMqttRef],
        resolve: (parent) => flatten<MqttConnection>(parent.mqtt),
      }),
      sources: t.field({
        type: [PlcConfigSourcesRef],
        resolve: (parent) => flatten<PlcSource>(parent.sources),
      }),
    }),
  });
  PlcRuntimeMqttRef.implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      brokerUrl: t.exposeString("brokerUrl", {
        nullable: true,
      }),
      groupId: t.exposeString("groupId", {
        nullable: true,
      }),
      clientId: t.exposeString("clientId", {
        nullable: true,
      }),
      username: t.exposeString("username", {
        nullable: true,
      }),
      password: t.exposeString("password", {
        nullable: true,
      }),
      version: t.exposeString("version", {
        nullable: true,
      }),
      state: t.string({
        resolve: (parent) => {
          return getNodeStateString(parent);
        },
      }),
    }),
  });
  PlcRuntimeSourceRef.implement({
    fields: (t) => ({
      type: t.exposeString("type"),
      id: t.exposeString("id"),
      name: t.exposeString("name"),
      description: t.exposeString("description"),
      enabled: t.exposeBoolean("enabled"),
      host: t.exposeString("host"),
      port: t.exposeInt("port"),
      retryMinDelay: t.exposeInt("retryMinDelay"),
      retryMaxDelay: t.exposeInt("retryMaxDelay"),
      state: t.string({
        resolve: (parent) => {
          if (isSourceModbus(parent)) {
            return getModbusStateString(parent.client);
          } else {
            return "Unknown";
          }
        },
      }),
      error: t.field({
        type: PlcRuntimeVariableErrorRef,
        resolve: (parent) => parent.client?.lastError,
      }),
    }),
  });
  PlcRuntimeVariableModbusSourceRef.implement({
    fields: (t) => ({
      id: t.string({
        resolve: (parent) => parent.id.toString(),
      }),
      type: t.exposeString("type"),
      register: t.exposeInt("register"),
      registerType: t.exposeString("registerType"),
      format: t.exposeString("format"),
      rate: t.exposeInt("rate"),
      error: t.field({
        type: PlcRuntimeVariableErrorRef,
        resolve: (parent) => parent.error,
      }),
    }),
  });
  PlcRuntimeVariableOpcuaSourceRef.implement({
    fields: (t) => ({
      id: t.string({
        resolve: (parent) => parent.id.toString(),
      }),
      type: t.exposeString("type"),
      rate: t.exposeInt("rate"),
      error: t.field({
        type: PlcRuntimeVariableErrorRef,
        resolve: (parent) => parent.error,
      }),
    }),
  });
  PlcRuntimeVariableRef.implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      description: t.exposeString("description"),
      datatype: t.exposeString("datatype"),
      default: t.string({
        resolve: (parent) => parent.default?.toString(),
      }),
      value: t.string({
        nullable: true,
        resolve: (parent) => {
          if ("value" in parent) {
            return parent.value?.toString();
          }
          return null;
        },
      }),
      source: t.field({
        type: PlcRuntimeVariableSourceRef,
        nullable: true,
        resolve: (parent) => {
          if ("source" in parent && parent.source) {
            const source = parent.source;
            if (isVariableModbusSourceRuntime(source)) {
              return source;
            }
            if (isVariableOpcuaSourceRuntime(source)) {
              return source;
            }
          }
          return null;
        },
      }),
    }),
  });
  PlcRuntimeTaskMetricsRef.implement({
    fields: (t) => ({
      waitTime: t.exposeFloat("waitTime"),
      executeTime: t.exposeFloat("executeTime"),
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
        resolve: (parent) => flatten<PlcTaskRuntime<S, V>>(parent.tasks),
      }),
      variables: t.field({
        type: [PlcRuntimeVariableRef],
        resolve: (parent) => flatten<PlcVariableRuntime<S>>(parent.variables),
      }),
      mqtt: t.field({
        type: [PlcRuntimeMqttRef],
        resolve: (parent) =>
          flatten<ReturnType<typeof createNode>>(parent.mqtt),
      }),
      sources: t.field({
        type: [PlcRuntimeSourceRef],
        resolve: (parent) => flatten<PlcSourceRuntime>(parent.sources),
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
    }));
  builder.mutationField("enableSource", (t) =>
    t.field({
      args: {
        sourceId: t.arg({ type: "String", required: true }),
      },
      type: PlcRef,
      resolve: (_, args, context) => {
        const { sourceId } = args;
        const plc = context.plc;
        if (!plc.runtime.sources[sourceId]) {
          throw new GraphQLError(`Source ${sourceId} not found`);
        }
        plc.runtime.sources[sourceId].enabled = true;
        return plc;
      },
    }));
  builder.mutationField("setValue", (t) =>
    t.field({
      args: {
        variableId: t.arg({ type: "String", required: true }),
        value: t.arg({ type: "String", required: true }),
      },
      type: PlcRef,
      resolve: (_, args, context) => {
        const { variableId, value } = args;
        const plc = context.plc;
        if (!plc.runtime.variables[variableId]) {
          throw new GraphQLError(`Variable ${variableId} not found`);
        }
        const datatype = plc.runtime.variables[variableId].datatype;
        if (datatype === "boolean") {
          plc.runtime.variables[variableId].value = value === "true";
        } else if (datatype === "number") {
          plc.runtime.variables[variableId].value = Number(value);
        } else {
          plc.runtime.variables[variableId].value = value;
        }
        return plc;
      },
    }));
  builder.subscriptionField("plc", (t) =>
    t.field({
      type: PlcRef,
      subscribe: () => pubsub.subscribe("plcUpdate"),
      resolve: (payload) => payload,
    }));
}
