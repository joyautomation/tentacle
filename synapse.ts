import {
  createNode,
  disconnectNode,
  type SparkplugMetric,
} from "@joyautomation/synapse";
import type { Plc } from "./types/types.ts";
import {
  isPlcVariableRuntimeWithSource,
  type PlcVariableRuntime,
  type PlcVariables,
  type PlcVariablesRuntime,
} from "./types/variables.ts";
import {
  isSourceModbus,
  type PlcSourceRuntime,
  type PlcSources,
  type PlcSourcesRuntime,
} from "./types/sources.ts";
import type { TypeStr } from "sparkplug-payload/sparkplugPayloadProto";
import { getModbusStateString } from "./modbus/client.ts";

export const variableTypeToSparkplugType = (datatype: string): TypeStr => {
  switch (datatype) {
    case "number":
      return "Float";
    case "boolean":
      return "Boolean";
    case "string":
      return "String";
    case "Template":
      return "Template";
    default:
      throw new Error(`Unknown variable type: ${datatype}`);
  }
};

export const variablesToMetrics = <
  S extends PlcSources,
  V extends PlcVariables<S>
>(
  variables: PlcVariablesRuntime<S, V>
) => {
  return Object.entries(variables).reduce(
    (acc, [key, variable]: [string, PlcVariableRuntime<S>]) => {
      acc[key] = {
        name: variable.id,
        properties: {
          description: {
            value: variable.description,
            type: "String",
          },
          ...(isPlcVariableRuntimeWithSource(variable)
            ? {
                source: {
                  value: variable.source.id,
                  type: "String",
                },
              }
            : {}),
        },
        type: variableTypeToSparkplugType(variable.datatype),
        value: variable.value || null,
        scanRate: variable.publishRate || 2500,
        ...(variable.datatype === "number"
          ? { deadband: variable.deadband }
          : {}),
      };
      return acc;
    },
    {} as Record<string, SparkplugMetric>
  );
};

const getStateFromSource = (source: PlcSourceRuntime) => {
  return isSourceModbus(source)
    ? getModbusStateString(source.client)
    : "unknown";
};

export const sourcesToMetrics = <S extends PlcSources>(
  sources: PlcSourcesRuntime<S>
) => {
  return Object.entries(sources).reduce(
    (acc, [key, source]: [string, PlcSourceRuntime]) => {
      acc[`source:${key}`] = {
        name: `source:${source.id}`,
        properties: {
          description: {
            value: source.description,
            type: "String",
          },
          type: {
            value: source.type,
            type: "String",
          },
          host: {
            value: source.host,
            type: "String",
          },
          ...(isSourceModbus(source)
            ? {
                error: {
                  value: source.client.lastError?.message || null,
                  type: "String",
                },
              }
            : {}),
        },
        type: "String",
        value: () => getStateFromSource(source) || "unknown",
        scanRate: 2500,
      };
      return acc;
    },
    {} as Record<string, SparkplugMetric>
  );
};

export function createPlcMqtt<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
) {
  const {
    config: { mqtt },
  } = plc;
  const resultMqtt: Record<string, ReturnType<typeof createNode>> = {};
  for (const [key, config] of Object.entries(mqtt)) {
    if (config.enabled) {
      resultMqtt[key] = createNode({
        id: key,
        brokerUrl: config.serverUrl,
        username: config.username,
        password: config.password,
        groupId: config.groupId,
        clientId: config.clientId,
        version: "spBv1.0",
        metrics: {},
        devices: {
          [config.deviceId]: {
            id: config.deviceId,
            metrics: {
              ...variablesToMetrics(plc.runtime.variables),
              ...sourcesToMetrics(plc.runtime.sources),
            },
          },
        },
      });
    }
  }
  plc.runtime.mqtt = resultMqtt;
  return () => destroyPlcMqtt(plc);
}

export function destroyPlcMqtt<S extends PlcSources, V extends PlcVariables<S>>(
  plc: Plc<S, V>
) {
  for (const node of Object.values(plc.runtime.mqtt)) {
    disconnectNode(node);
  }
  plc.runtime.mqtt = {};
  return plc;
}

export const updateMetricValues = <
  S extends PlcSources,
  V extends PlcVariables<S>
>(
  plc: Plc<S, V>
) => {
  for (const [key, variable] of Object.entries(plc.runtime.variables)) {
    for (const node of Object.values(plc.runtime.mqtt)) {
      const deviceId = Object.keys(node.devices)[0];
      node.devices[deviceId].metrics[key].value = variable.value;
    }
  }
};
