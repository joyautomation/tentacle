import { createTentacle } from "../index.ts";
import { VariablesRuntime } from "../types.ts";

const isNumber = (value: unknown): value is number => typeof value === "number";

createTentacle(
  {
    tasks: {
      main: {
        name: "main",
        description: "The main task",
        scanRate: 1000,
        program: (variables: VariablesRuntime) => {
          if (!isNumber(variables.count.value)) variables.count.value = 0;
          if (isNumber(variables.count.value)) {
            variables.count.value = variables.count.value + 1;
          }
          console.log("count", variables.count.value);
        },
      },
    },
    mqtt: {},
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
    },
  },
);
