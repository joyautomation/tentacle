import { PlcSources, PlcModbusSource } from "../../types/sources.ts";
import { PlcVariableNumberWithModbusSource } from "../../types/variables.ts";
import { AdamSources } from "../sources/adam.ts";

type DPFSide = "L" | "R";
type DPFNumber = 1 | 2 | 3 | 4 | 5;

export type AdamVariables<S extends PlcSources = AdamSources> = {
  [K in `DPF_T-${DPFSide}${DPFNumber}`]: PlcVariableNumberWithModbusSource<S>;
};

const generateVariables = (): AdamVariables<AdamSources> => {
  const sides: DPFSide[] = ["L", "R"];
  const numbers: DPFNumber[] = [1, 2, 3, 4, 5];

  const result = {} as Record<
    `DPF_T-${DPFSide}${DPFNumber}`,
    PlcVariableNumberWithModbusSource<AdamSources>
  >;

  for (const side of sides) {
    for (const number of numbers) {
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
      result[key] = variable;
    }
  }

  return result;
};

export const adamVariables: AdamVariables<AdamSources> = generateVariables();
