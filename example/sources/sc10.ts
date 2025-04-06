import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

export type Sc10Id = "SC_PM" | "SC_HTR";

export type Sc10Sources = {
  [K in Sc10Id]: PlcModbusSource;
};

const Sc10SourceConfig = {
  SC_PM: {
    id: "SC_PM",
    host: "192.168.20.6",
    description: "Banner Safety Controller PM",
  },
  SC_HTR: {
    id: "SC_HTR",
    host: "192.168.20.7",
    description: "Banner Safety Controller HTR",
  },
};

export const getSc10Sources = (): Sc10Sources => {
  return Object.fromEntries(
    Object.entries(Sc10SourceConfig).map(([id, config]) => [
      id,
      getModbusConfigBase(config),
    ])
  ) as Sc10Sources;
};

export const sc10Sources = getSc10Sources();
