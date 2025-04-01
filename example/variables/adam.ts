import type { PlcSources } from "../../types/sources.ts";
import type { PlcVariableNumberWithModbusSource } from "../../types/variables.ts";
import type { AdamSources } from "../sources/adam.ts";

type DPFSide = "L" | "R";
type DPFNumber = 1 | 2 | 3 | 4 | 5;

export type AdamVariables<S extends PlcSources = AdamSources> = {
  [K in `DPF_T-${DPFSide}${DPFNumber}`]: PlcVariableNumberWithModbusSource<S>;
};

const getAdamVariables = (): AdamVariables<AdamSources> => {
  const sides: DPFSide[] = ["L", "R"];
  const numbers: DPFNumber[] = [1, 2, 3, 4, 5];

  const result = Object.fromEntries(
    sides.flatMap((side) =>
      numbers.map((number) => {
        const key = `DPF_T-${side}${number}` as const;
        const variable: PlcVariableNumberWithModbusSource<AdamSources> = {
          id: key,
          datatype: "number",
          description: `DPF_T-${side}${number}`,
          default: 0,
          source: {
            id: `RGN_${side === "L" ? "P" : "S"}`,
            type: "modbus",
            register: 0,
            registerType: "INPUT_REGISTER",
            format: "FLOAT",
            rate: 1000,
          },
        };
        return [key, variable] as const;
      })
    )
  ) as Record<
    `DPF_T-${DPFSide}${DPFNumber}`,
    PlcVariableNumberWithModbusSource<AdamSources>
  >;

  return result;
};

export const adamVariables: AdamVariables<AdamSources> = getAdamVariables();
