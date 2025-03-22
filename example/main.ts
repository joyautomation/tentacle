import { createTentacle } from "../index.ts";
import { PlcModbusSource } from "../types/sources.ts";
import {
  PlcVariableBoolean,
  PlcVariableNumber,
  PlcVariableNumberWithModbusSource,
} from "../types/variables.ts";
import { AdamSources, adamSources } from "./sources/adam.ts";
import { AdamVariables, adamVariables } from "./variables/adam.ts";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

type Sources = {
  // AdamSources & {
  // "codesys-mb": PlcModbusSource;
};

type Variables = {
  //AdamVariables & {
  count: PlcVariableNumber;
  // aBool: PlcVariableBoolean;
  // modbusCount: PlcVariableNumberWithModbusSource<Sources>;
};

const main = await createTentacle<Sources, Variables>({
  redisUrl: "redis://10.3.37.5:6379",
  // ha: {
  //   lease: "tentacle-test",
  //   namespace: "xbox1",
  // },
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
    // local: {
    //   enabled: true,
    //   name: "local",
    //   description: "Local MQTT connection",
    //   serverUrl: `mqtt://${Deno.env.get("TENTACLE_EXAMPLE_MQTT_HOST")}:1883`,
    //   username: "user",
    //   password: "password",
    //   groupId: "joy",
    //   clientId: `client1-${nanoid(7)}`,
    //   nodeId: "tentacle-dev",
    //   deviceId: "tentacle-dev",
    //   version: "spBv1.0",
    // },
  },
  sources: {
    // ...adamSources,
    // "codesys-mb": {
    //   id: "codesys-mb",
    //   type: "modbus",
    //   enabled: true,
    //   name: "codesys-mb",
    //   description: "Codesys Modbus connection",
    //   host: `${Deno.env.get("TENTACLE_EXAMPLE_MODBUS_HOST")}`,
    //   port: 502,
    //   unitId: 1,
    //   reverseBits: false,
    //   reverseWords: false,
    //   retryMinDelay: 1000,
    //   retryMaxDelay: 60000,
    // },
  },
  variables: {
    // ...adamVariables,
    count: {
      id: "count",
      datatype: "number",
      description: "A counter",
      default: 0,
    },
    // aBool: {
    //   id: "aBool",
    //   datatype: "boolean",
    //   description: "A boolean",
    //   default: false,
    //   persistent: true,
    // },
    // modbusCount: {
    //   id: "modbusCount",
    //   datatype: "number",
    //   description: "A counter",
    //   default: 0,
    //   persistent: true,
    //   source: {
    //     id: "codesys-mb",
    //     type: "modbus",
    //     register: 0,
    //     registerType: "INPUT_REGISTER",
    //     format: "INT16",
    //     rate: 1000,
    //   },
    // },
  },
});

main();
