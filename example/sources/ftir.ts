import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

export type FtirLocation = "I" | "O";
export type FtirSources = {
  [K in `FTIR.${FtirLocation}`]: PlcModbusSource;
};

const getFtirSources = (): FtirSources => {
  const locations: FtirLocation[] = ["I", "O"];
  return Object.fromEntries(
    locations.map((location) => [
      `FTIR_${location}`,
      getModbusConfigBase({
        id: `FTIR_${location}`,
        host: `10.154.92.36`, //`192.168.20.${location === "I" ? 51 : 151}`,
        description: `Fourier Transform Infrared Spectroscopy ${
          location === "I" ? "Input" : "Output"
        }`,
      }),
    ]),
  ) as FtirSources;
};

export const ftirSources = getFtirSources();
