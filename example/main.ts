import {
  createTentacle,
  type PlcSource,
  type PlcVariableNumberWithMqttSource,
  type PlcVariableNumberWithModbusSource,
  PlcModbusSource,
  PlcRedisSource,
  PlcVariableNumberWithRedisSource,
  PlcVariableBooleanWithRedisSource,
} from "../index.ts";
import type { MqttConnection } from "../types/mqtt.ts";
import type { PlcVariableNumber } from "../types/variables.ts";
import { customAlphabet } from "nanoid";
import { pipe } from "@joyautomation/dark-matter";
import { ftirSources, FtirSources } from "./sources/ftir.ts";
import { getModbusConfigBase } from "./sources/modbus.ts";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

type Mqtts = {
  local: MqttConnection;
};

type Sources = {
  modbus: PlcModbusSource;
  fr202: PlcRedisSource;
};

type Variables = {
  // FtirVariables & {
  count: PlcVariableNumber;
  temperature: PlcVariableNumberWithMqttSource<Mqtts>;
  modbusValue: PlcVariableNumberWithModbusSource<Sources>;
  redisValue: PlcVariableNumberWithRedisSource<Sources>;
  redisBooleanDi: PlcVariableBooleanWithRedisSource<Sources>;
  redisBooleanDo: PlcVariableBooleanWithRedisSource<Sources>;
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
    (value: number) => value / 10
  );

function numberToHexString(num?: number | boolean | string): string {
  // Convert number to a hex string
  let hexString = num?.toString(16) || "00";

  // Pad with leading zeros to ensure it's 2 characters long
  while (hexString.length < 2) {
    hexString = "0" + hexString;
  }

  return hexString.toUpperCase(); // Convert to uppercase for consistency
}

const main = await createTentacle<Mqtts, Sources, Variables>({
  redisUrl: `redis://${Deno.env.get("TENTACLE_EXAMPLE_REDIS_HOST")}:6379`,
  tasks: {
    main: {
      name: "main",
      description: "The main task",
      scanRate: 1000,
      program: async (variables, setVar) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setVar("count", variables.count.value + 1);
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
    modbus: getModbusConfigBase({
      id: `modbus`,
      host: `10.154.92.36`,
      description: `Modbus Source`,
      reverseBits: false,
    }),
    fr202: {
      id: `fr202`,
      enabled: true,
      name: `FR202`,
      description: `FR202`,
      host: `10.154.92.36`,
      port: 60000,
      retryMinDelay: 1000,
      retryMaxDelay: 5000,
      type: "redis",
      redisUrl: `redis://192.168.82.25:6379`,
    },
  },
  variables: {
    redisBooleanDi: {
      id: "redisBoolean",
      datatype: "boolean",
      description: "Redis Boolean",
      default: false,
      source: {
        id: "fr202",
        type: "redis",
        key: "fr202:di:0:0",
        onResponse: (value: string) => Boolean(Number(value)),
      },
    },
    redisBooleanDo: {
      id: "redisBooleanDo",
      datatype: "boolean",
      description: "Redis Boolean",
      default: false,
      source: {
        id: "fr202",
        type: "redis",
        key: "fr202:do:0:1",
        bidirectional: true,
        onResponse: (value: string) => Boolean(Number(value)),
        onSend: (value: boolean) => (!value ? "1" : "0"),
      },
    },
    redisValue: {
      id: "redisValue",
      datatype: "number" as const,
      decimals: 2,
      description: "Redis Value",
      default: 0,
      deadband: {
        maxTime: 60000,
        value: 0.001,
      },
      source: {
        id: "fr202",
        type: "redis",
        key: "fr202:ai:2",
        onResponse: (value: string) => Number(value),
      },
    },
    modbusValue: {
      id: "modbusValue",
      datatype: "number" as const,
      decimals: 2,
      description: "Modbus Value",
      default: 0,
      deadband: {
        maxTime: 60000,
        value: 0.001,
      },
      source: {
        id: "modbus",
        type: "modbus" as const,
        rate: 1000,
        register: 2,
        registerType: "INPUT_REGISTER" as const,
        format: "INT16" as const,
      },
    },
    count: {
      id: "count",
      datatype: "number",
      description: "A counter",
      decimals: 0,
      default: 0,
    },
    temperature: {
      id: "temperature",
      datatype: "number",
      description: "Temperature",
      default: 0,
      decimals: 2,
      source: {
        id: "local",
        type: "mqtt",
        topic: "instruments/pm_20_26",
        onResponse: (value) => {
          const raw = JSON.parse(value.toString());
          const {
            data: { payload },
          } = raw;
          const { data: temperatureRaw } =
            payload["/iolinkmaster/port[1]/iolinkdevice/pdin"];
          return hexToValue(temperatureRaw);
        },
      },
    },
  },
});

main();
