import { SparkplugNode } from "@joyautomation/synapse";
import { PlcConfig, PlcTask, PlcTaskRuntime, Variable } from "../types.ts";

export type Plc = {
  config: PlcConfig;
  variables: Record<
    string,
    Variable & { value: boolean | number | string | null }
  >;
  tasks: Record<
    string,
    PlcTaskRuntime
  >;
  mqtt: Record<string, SparkplugNode>;
};
