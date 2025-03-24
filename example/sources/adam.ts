import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

type side = "P" | "S";
export type AdamSources = {
  [K in `RGN_${side}`]: PlcModbusSource;
};

const generateAdamSources = (): AdamSources => {
  const sides: side[] = ["P", "S"];
  return Object.fromEntries(
    sides.map((side) => [
      `RGN_${side}`,
      getModbusConfigBase({
        id: `RGN_${side}`,
        host: `192.168.20.20${side === "P" ? 0 : 1}`,
        description: `Port Temperatures ${side}`,
      }),
    ]),
  ) as AdamSources;
};

export const adamSources = generateAdamSources();
