import { createTentacle } from "../index.ts";
import {
  PlcVariableBoolean,
  PlcVariableNumber,
  PlcVariablesRuntime,
} from "../types.ts";

type MyVariables = {
  count: PlcVariableNumber;
  aBool: PlcVariableBoolean;
};

createTentacle<MyVariables>(
  {
    tasks: {
      main: {
        name: "main",
        description: "The main task",
        scanRate: 1000,
        program: (variables) => {
          variables.count.value = variables.count.value + 1;
        },
      },
    },
    mqtt: {
      local: {
        enabled: true,
        name: "local",
        description: "Local MQTT connection",
        serverUrl: "mqtt://10.154.92.210:1883",
        username: "user",
        password: "password",
        groupId: "joy",
        clientId: "client1",
        nodeId: "tentacle-dev",
        deviceId: "tentacle-dev",
        version: "spBv1.0",
      },
    },
    modbus: {},
    opcua: {},
    variables: {
      count: {
        id: "count",
        datatype: "number",
        description: "A counter",
        default: 0,
        persistent: true,
      },
      aBool: {
        id: "aBool",
        datatype: "boolean",
        description: "A boolean",
        default: false,
        persistent: true,
      },
    },
  },
);
