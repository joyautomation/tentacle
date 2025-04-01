import type { PlcSources } from "../../types/sources.ts";
import type { PlcVariableNumberWithModbusSource } from "../../types/variables.ts";
import {
  type FtirLocation,
  type FtirSources,
  ftirSources,
} from "../sources/ftir.ts";

export type FtirVariableId =
  | "P"
  | "T"
  | "C2H4"
  | "C2H6"
  | "CH4"
  | "CO"
  | "CO2"
  | "H2O"
  | "N2O"
  | "NH3"
  | "NO"
  | "NO2"
  | "O2.BG"
  | "SF6"
  | "SO2"
  | "THC";

export type FtirVariables<S extends PlcSources = FtirSources> = {
  [K in `FTIR.${FtirLocation}_${FtirVariableId}`]: PlcVariableNumberWithModbusSource<S>;
};

export const ftirVariableConfig = {
  P: { id: "P", register: 0 },
  T: { id: "T", register: 2 },
  C2H4: { id: "C2H4", register: 34 },
  C2H6: { id: "C2H6", register: 46 },
  CH4: { id: "CH4", register: 12 },
  CO: { id: "CO", register: 14 },
  CO2: { id: "CO2", register: 16 },
  H2O: { id: "H2O", register: 18 },
  N2O: { id: "N2O", register: 24 },
  NH3: { id: "NH3", register: 22 },
  NO: { id: "NO", register: 26 },
  NO2: { id: "NO2", register: 28 },
  O2: { id: "O2.BG", register: 46 },
  SF6: { id: "SF6", register: 54 },
  SO2: { id: "SO2", register: 30 },
  THC: { id: "THC", register: 56 },
};

export const getFtirVariables = (): FtirVariables => {
  const result = Object.fromEntries(
    Object.entries(ftirSources).flatMap(([sourceId, sourceConfig]) => {
      const typedSourceId = sourceId as keyof FtirSources;
      return Object.entries(ftirVariableConfig).map(
        ([variableConfigId, variableConfig]) => {
          const typedVariableConfigId = variableConfigId as keyof FtirVariables;
          const id = `FTIR.${typedSourceId}_${typedVariableConfigId}`;
          const variable: PlcVariableNumberWithModbusSource<FtirSources> = {
            id,
            datatype: "number" as const,
            description: `${sourceConfig.description} ${variableConfig.id}`,
            default: 0,
            deadband: {
              maxTime: 60000,
              value: 0.1,
            },
            source: {
              id: typedSourceId,
              type: "modbus" as const,
              rate: 1000,
              register: variableConfig.register,
              registerType: "HOLDING_REGISTER" as const,
              format: "FLOAT" as const,
            },
          };
          return [id, variable];
        }
      );
    })
  ) as FtirVariables;
  return result;
};

export const ftirVariables: FtirVariables = getFtirVariables();
