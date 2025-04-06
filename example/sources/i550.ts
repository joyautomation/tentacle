import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

export type I550Id = "FAN" | "RGN_F";

export type I550Sources = {
  [K in I550Id]: PlcModbusSource;
};

const i550SourceConfig = {
  FAN: {
    id: "FAN",
    description: "Main Fan",
    host: "192.168.20.24",
  },
  RGN_F: {
    id: "RGN_F",
    description: "Refen Fan",
    host: "192.168.20.25",
  },
};

export const getI550Sources = (): I550Sources => {
  return Object.fromEntries(
    Object.entries(i550SourceConfig).map(([id, config]) => [
      id,
      getModbusConfigBase(config),
    ])
  ) as I550Sources;
};

export const i550Sources = getI550Sources();
