import { createTentacle, type PlcVariableBoolean } from "../index.ts";
import type { PlcVariableNumber } from "../types/variables.ts";
import { type FtirSources, ftirSources } from "./sources/ftir.ts";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

type Sources = FtirSources;

type Variables = {
  // FtirVariables & {
  count: PlcVariableNumber;
  another: PlcVariableNumber;
  yetAnother: PlcVariableBoolean;
};

const main = await createTentacle<Sources, Variables>({
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
    ...ftirSources,
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
    // ...ftirVariables,
  },
});

main();
