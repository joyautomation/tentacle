import { createNode, SparkplugMetric } from "@joyautomation/synapse";
import { Plc, PlcVariables, PlcVariablesRuntime } from "./types.ts";
import { TypeStr } from "sparkplug-payload/sparkplugPayloadProto";

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

export const variablesToMetrics = <V extends PlcVariables>(
  variables: PlcVariablesRuntime<V>,
) => {
  return Object.entries(variables).reduce((acc, [key, variable]) => {
    acc[key] = {
      name: variable.id,
      properties: {
        description: {
          value: variable.description,
          type: "String",
        },
      },
      type: variableTypeToSparkplugType(variable.datatype),
      value: variable.value,
      scanRate: variable.publishRate || 2500,
      deadband: variable.deadband,
    };
    return acc;
  }, {} as Record<string, SparkplugMetric>);
};

export function createPlcMqtt<V extends PlcVariables>(plc: Plc<V>) {
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
            metrics: variablesToMetrics(plc.runtime.variables),
          },
        },
      });
    }
  }
  plc.runtime.mqtt = resultMqtt;
  return plc;
}

export const updateMetricValues = <V extends PlcVariables>(plc: Plc<V>) => {
  for (const [key, variable] of Object.entries(plc.runtime.variables)) {
    for (const node of Object.values(plc.runtime.mqtt)) {
      const deviceId = Object.keys(node.devices)[0];
      node.devices[deviceId].metrics[key].value = variable.value;
    }
  }
};
