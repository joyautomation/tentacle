import { PlcModbusSource } from "../../types/sources.ts";

type side = "P" | "S";
export type AdamSources = {
  [K in `RGN_${side}`]: PlcModbusSource;
};

const generateAdamSources = (): AdamSources => {
  const sides: side[] = ["P", "S"];
  return Object.fromEntries(
    sides.map((side) => [
      `RGN_${side}`,
      adamConfigBase({
        id: `RGN_${side}`,
        host: `192.168.20.20${side === "P" ? 0 : 1}`,
        description: `Port Temperatures ${side}`,
      }),
    ])
  ) as AdamSources;
};

const adamConfigBase = ({
  id,
  host,
  description,
}: {
  id: string;
  description: string;
  host: string;
}): PlcModbusSource => ({
  id,
  description,
  type: "modbus",
  enabled: true,
  name: id,
  host,
  port: 502,
  unitId: 1,
  reverseBits: false,
  reverseWords: false,
  retryMinDelay: 1000,
  retryMaxDelay: 60000,
});

export const adamSources = generateAdamSources();
