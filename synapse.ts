import { createNode } from "@joyautomation/synapse";
import { Plc } from "./plc/types.ts";
import { SparkplugMetric } from "@joyautomation/synapse";
import { Variable } from "./types.ts";
import { TypeStr } from "npm:sparkplug-payload@1.0.3/sparkplugPayloadProto";

export const variableTypeToSparkplugType = (
  type: Variable["datatype"]
): TypeStr => {
  switch (type) {
    case "number":
      return "Float";
    case "boolean":
      return "Boolean";
    case "string":
      return "String";
  }
};

export const variablesToMetrics = (
  variables: Record<string, Plc["variables"][number]>
) => {
  return Object.entries(variables).reduce((acc, [key, variable]) => {
    acc[key] = {
      name: variable.id,
      type: variableTypeToSparkplugType(variable.datatype),
      value: variable.value,
      scanRate: variable.publishRate || 2500,
      deadband: variable.deadband,
    };
    return acc;
  }, {} as Record<string, SparkplugMetric>);
};

export async function createPlcMqtt(plc: Plc) {
  const {
    config: { mqtt },
  } = plc;
  const resultMqtt: {
    [key: string]: ReturnType<typeof createNode>;
  } = {};
  for (const [key, config] of Object.entries(mqtt)) {
    console.log(config);
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
          metrics: variablesToMetrics(plc.variables),
        },
      },
    });
  }
  plc.mqtt = resultMqtt;
  return plc;
}

export const updateMetricValues = (plc: Plc) => {
  for (const [key, variable] of Object.entries(plc.variables)) {
    for (const node of Object.values(plc.mqtt)) {
      const deviceId = Object.keys(node.devices)[0];
      node.devices[deviceId].metrics[key].value = variable.value;
    }
  }
};
