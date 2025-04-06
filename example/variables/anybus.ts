import type { PlcSources } from "../../types/sources.ts";
import type { PlcVariableNumberWithModbusSource } from "../../types/variables.ts";
import type {
  AnybusHeatedLineId,
  AnybusRegenHeaterId,
  AnybusRegenHeaterType,
  AnybusSources,
} from "../sources/anybus.ts";
import { anybusSources } from "../sources/anybus.ts";

export type AnybusVariableId = "Tsp" | "Tpv" | "%";

export type AnybusVariables<S extends PlcSources = AnybusSources> = {
  [K in `RGN.${AnybusRegenHeaterType}.${AnybusRegenHeaterId}_${AnybusVariableId}`]: PlcVariableNumberWithModbusSource<S>;
} & {
  [K in `HTDL.${AnybusHeatedLineId}_${AnybusVariableId}`]: PlcVariableNumberWithModbusSource<S>;
};

const anybusVariableConfig = {
  Tsp: {
    id: "Tsp",
    description: "Setpoint",
    register: 262,
    bidirectional: true,
  },
  Tpv: {
    id: "Tpv",
    description: "Process Value",
    register: 0,
    bidirectional: false,
  },
  "%": {
    id: "%",
    description: "Manipulated Value",
    register: 8,
    bidirectional: false,
  },
};

const deriveMultiplier = (id: string) => {
  if ((id.startsWith("RGN") || id.startsWith("HTR.OT")) && !id.endsWith("%")) {
    return 1;
  } else {
    return 10;
  }
};

export const getAnybusVariables = (): AnybusVariables => {
  const result = Object.fromEntries(
    Object.entries(anybusSources).flatMap(([sourceId, _sourceConfig]) => {
      const typedSourceId = sourceId as keyof AnybusSources;
      return Object.entries(anybusVariableConfig).map(
        ([variableConfigId, variableConfig]) => {
          const typedVariableConfigId =
            variableConfigId as keyof AnybusVariables;
          const id = `${typedSourceId}.${typedVariableConfigId}`;
          const variable: PlcVariableNumberWithModbusSource<AnybusSources> = {
            id,
            datatype: "number",
            description: variableConfig.description,
            default: 0,
            deadband: {
              maxTime: 60000,
              value: 0.1,
            },
            source: {
              id: typedSourceId,
              type: "modbus",
              rate: 1000,
              bidirectional: variableConfig.bidirectional || false,
              onResponse: (value: string) => {
                return Number(value) / deriveMultiplier(id);
              },
              onSend: (value: number) => {
                return Number(value) * deriveMultiplier(id);
              },
              register: variableConfig.register,
              registerType: "HOLDING_REGISTER",
              format: "INT32",
            },
          };
          return [id, variable];
        }
      );
    })
  ) as AnybusVariables;
  return result;
};

export const anybusVariables: AnybusVariables = getAnybusVariables();
