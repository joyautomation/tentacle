import { createTentacle } from "../index.ts";
import { PlcModbusSource } from "../types/sources.ts";
import {
  PlcVariableBoolean,
  PlcVariableNumber,
  PlcVariableNumberWithModbusSource,
} from "../types/variables.ts";

type Sources = {
  "codesys-mb": PlcModbusSource;
};

type Variables = {
  count: PlcVariableNumber;
  aBool: PlcVariableBoolean;
  modbusCount: PlcVariableNumberWithModbusSource<Sources>;
};

createTentacle<Variables, Sources>({
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
      serverUrl: "mqtt://10.3.37.5:1883",
      username: "user",
      password: "password",
      groupId: "joy",
      clientId: "client1",
      nodeId: "tentacle-dev",
      deviceId: "tentacle-dev",
      version: "spBv1.0",
    },
  },
  sources: {
    "codesys-mb": {
      id: "codesys-mb",
      type: "modbus",
      enabled: true,
      name: "codesys-mb",
      description: "Codesys Modbus connection",
      host: "10.3.37.143",
      port: 502,
      unitId: 1,
      reverseBits: false,
      reverseWords: false,
      retryMinDelay: 1000,
      retryMaxDelay: 60000,
    },
  },
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
    modbusCount: {
      id: "modbusCount",
      datatype: "number",
      description: "A counter",
      default: 0,
      persistent: true,
      source: {
        id: "codesys-mb",
        type: "modbus",
        register: 0,
        registerType: "INPUT_REGISTER",
        format: "INT16",
        rate: 1000,
      },
    },
  },
});
