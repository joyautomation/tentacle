import { json } from "node:stream/consumers";
import {
  createTentacle,
  type PlcVariableBoolean,
  PlcVariableNumberWithMqttSource,
} from "../index.ts";
import { MqttConnection } from "../types/mqtt.ts";
import type { PlcVariableNumber } from "../types/variables.ts";
import { type FtirSources, ftirSources } from "./sources/ftir.ts";
import { customAlphabet } from "nanoid";
import { pipe } from "@joyautomation/dark-matter";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

type Mqtts = {
  local: MqttConnection;
};

type Sources = {}; //FtirSources;

type Variables = {
  // FtirVariables & {
  count: PlcVariableNumber;
  another: PlcVariableNumber;
  yetAnother: PlcVariableBoolean;
  temperature: PlcVariableNumberWithMqttSource<Mqtts>;
};

const hexToValue = (hexString: string) =>
  pipe(
    hexString,
    (hexString: string) =>
      hexString != null ? hexString?.slice(0, 2) + hexString?.slice(2, 4) : "",
    (hexString: string) => parseInt(hexString, 16),
    // (hex: number) => {
    //   const result = new Uint8Array(4);
    //   const buffer = new ArrayBuffer(4);
    //   const view = new DataView(buffer);
    //   view.setUint32(0, hex, true);
    //   return view.getFloat32(0, false);
    // },
    (value: number) => value / 10,
  );

const main = await createTentacle<Mqtts, Sources, Variables>({
  redisUrl: `redis://${Deno.env.get("TENTACLE_EXAMPLE_REDIS_HOST")}:6379`,
  // ha: {
  //   lease: "tentacle-test",
  //   namespace: "xbox1",
  // },
  tasks: {
    main: {
      name: "main",
      description: "The main task",
      scanRate: 1000,
      program: async (variables) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        variables.count.value = variables.count.value + 1;
      },
    },
    secondary: {
      name: "secondary",
      description: "The secondary task",
      scanRate: 1000,
      program: async (variables) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        variables.yetAnother.value = !variables.yetAnother.value;
        throw new Error("Something went wrong");
      },
    },
  },
  mqtt: {
    local: {
      enabled: true,
      name: "local",
      description: "Local MQTT connection",
      serverUrl: `mqtt://${Deno.env.get("TENTACLE_EXAMPLE_MQTT_HOST")}:1883`,
      username: "user",
      password: "password",
      groupId: "joy",
      clientId: `client1-${nanoid(7)}`,
      nodeId: "tentacle-dev",
      deviceId: "tentacle-dev",
      version: "spBv1.0",
    },
  },
  sources: {
    // ...ftirSources,
  },
  variables: {
    count: {
      id: "count",
      datatype: "number",
      description: "A counter",
      default: 0,
    },
    another: {
      id: "another",
      datatype: "number",
      description: "Another counter",
      default: 2,
    },
    yetAnother: {
      id: "yetAnother",
      datatype: "boolean",
      description: "A boolean",
      default: false,
    },
    temperature: {
      id: "temperature",
      datatype: "number",
      description: "Temperature",
      default: 0,
      source: {
        id: "local",
        type: "mqtt",
        topic: "instruments/pm_20_26",
        onResponse: (value) => {
          const raw = JSON.parse(value.toString());
          const { data: { payload } } = raw;
          const { data: temperatureRaw } =
            payload["/iolinkmaster/port[1]/iolinkdevice/pdin"];
          return hexToValue(temperatureRaw);
        },
      },
    },
    // ...ftirVariables,
  },
});

main();
