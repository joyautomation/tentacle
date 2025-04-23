import {
  createNode,
  disconnectNode,
  type SparkplugMetric,
} from "@joyautomation/synapse";
import type { Plc } from "./types/types.ts";
import {
  hasMqttSource,
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
import type { PlcMqtts } from "./types/mqtt.ts";
import { updateRuntimeValue } from "./plc/runtime.ts";
import type { Buffer } from "node:buffer";

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
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>,
>(
  variables: PlcVariablesRuntime<M, S, V>,
) => {
  return Object.entries(variables).reduce(
    (acc, [key, variable]: [string, PlcVariableRuntime<M, S>]) => {
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
    {} as Record<string, SparkplugMetric>,
  );
};

const getStateFromSource = (source: PlcSourceRuntime) => {
  return isSourceModbus(source)
    ? getModbusStateString(source.client)
    : "unknown";
};

export const sourcesToMetrics = <S extends PlcSources>(
  sources: PlcSourcesRuntime<S>,
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
    {} as Record<string, SparkplugMetric>,
  );
};

export function createPlcMqtt<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>,
>(
  plc: Plc<M, S, V>,
) {
  const {
    config: { mqtt },
  } = plc;
  const resultMqtt: Record<string, ReturnType<typeof createNode>> = {};
  for (const [mqttKey, config] of Object.entries(mqtt)) {
    if (config.enabled) {
      resultMqtt[mqttKey] = createNode({
        id: config.nodeId,
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
      const sourceVariables = Object.fromEntries(
        Object.entries(plc.runtime.variables)
          .filter(([_, variable]) => {
            if (hasMqttSource(variable)) {
              return variable.source.id === mqttKey;
            }
            return false;
          })
          .map((
            [key, variable],
          ) => [key, { ...variable, source: variable.source }]),
      ) as PlcVariablesRuntime<M, S, V>;
      if (Object.keys(sourceVariables).length > 0) {
        const topics = Object.values(sourceVariables).reduce(
          (acc: Record<string, PlcVariablesRuntime<M, S, V>>, variable) => {
            if (!acc[`${variable.source.topic}`]) {
              acc[`${variable.source.topic}`] = Object.fromEntries(
                Object.entries(sourceVariables).filter(
                  ([_, v]) => {
<<<<<<< HEAD
                    return v.source.topic === variable.source.topic
                  }
=======
                    return v.source.topic === variable.source.topic;
                  },
>>>>>>> timestamp
                ),
              ) as PlcVariablesRuntime<M, S, V>;
            }
            return acc;
          },
          {} as Record<string, PlcVariablesRuntime<M, S, V>>,
        );
        // console.log('topics', Object.keys(topics).map((key) => Object.keys(topics[key])))
        const handlers: Record<
          string,
          (topic: string, message: Buffer) => void
        > = Object.fromEntries(
          Object.entries(topics).map(([subscribedTopic, variables]) => {
            return [
              subscribedTopic,
              (topic: string, message: Buffer) => {
                if (topic !== subscribedTopic) return;
                for (
                  const [variableId, variable] of Object.entries(variables)
                ) {
                  const value = variable.source.onResponse
                    ? variable.source.onResponse(message)
                    : message;
                  updateRuntimeValue(plc, variableId, value);
                }
              },
            ];
          }),
        );
        for (const [subscribedTopic, handler] of Object.entries(handlers)) {
          resultMqtt[mqttKey]?.mqtt?.subscribe(subscribedTopic, { qos: 0 });
          resultMqtt[mqttKey]?.mqtt?.on("message", handler);
        }
      }
    }
  }
  plc.runtime.mqtt = resultMqtt;
  return () => destroyPlcMqtt(plc);
}

export function destroyPlcMqtt<
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>,
>(
  plc: Plc<M, S, V>,
) {
  for (const node of Object.values(plc.runtime.mqtt)) {
    disconnectNode(node);
  }
  plc.runtime.mqtt = {};
  return plc;
}

export const updateMetricValues = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>,
>(
  plc: Plc<M, S, V>,
) => {
  for (const [key, variable] of Object.entries(plc.runtime.variables)) {
    for (const node of Object.values(plc.runtime.mqtt)) {
      const deviceId = Object.keys(node.devices)[0];
      node.devices[deviceId].metrics[key].value = variable.value;
    }
  }
};
