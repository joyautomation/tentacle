import { PlcConfig, PlcTasksRuntime, VariablesRuntime } from "../types.ts";

export type Plc = {
  config: PlcConfig;
  runtime: {
    variables: VariablesRuntime;
    tasks: PlcTasksRuntime;
  };
};
