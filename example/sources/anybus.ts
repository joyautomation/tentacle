import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

type AnybusRegenHeaterId = "A" | "B";
type AnybusRegenHeaterType = "PID" | "OT";
type AnybusHeatedLineId = "IN" | "OUT" | "2FTIR" | "2FID";

export type AnybusSources =
  & {
    [K in `RGN.${AnybusRegenHeaterType}.${AnybusRegenHeaterId}`]:
      PlcModbusSource;
  }
  & {
    [K in `HTDL.${AnybusHeatedLineId}`]: PlcModbusSource;
  };

const anybusConfig = {
  regen: {
    host: "192.168.20.10",
    types: ["PID", "OT"] as const,
    ids: ["A", "B"] as const,
    getDescription: (type: AnybusRegenHeaterType, id: AnybusRegenHeaterId) =>
      type === "OT" ? `Regen OT ${id}` : `Regen ${id}`,
  },
  heatedLine: {
    host: "192.168.20.40",
    ids: ["IN", "OUT", "2FTIR", "2FID"] as const,
    descriptions: {
      "IN": "Heated Line Inlet",
      "OUT": "Heated Line Outlet",
      "2FTIR": "Heated Line Sampl to FTIR",
      "2FID": "Heated Line FTIR to FID",
    } as const,
  },
} as const;

// Helper type to extract all possible regen source IDs
type RegenSourceId = `RGN.${typeof anybusConfig.regen.types[
  number
]}.${typeof anybusConfig.regen.ids[number]}`;

// Helper type to extract all possible heated line source IDs
type HeatedLineSourceId = `HTDL.${typeof anybusConfig.heatedLine.ids[number]}`;

export const getAnybusSources = (): AnybusSources => {
  // Create the regen sources with explicit typing
  const regenSources: Record<RegenSourceId, PlcModbusSource> = {} as Record<
    RegenSourceId,
    PlcModbusSource
  >;
  for (const type of anybusConfig.regen.types) {
    for (const id of anybusConfig.regen.ids) {
      const sourceId = `RGN.${type}.${id}` as RegenSourceId;
      regenSources[sourceId] = getModbusConfigBase({
        id: sourceId,
        host: anybusConfig.regen.host,
        description: anybusConfig.regen.getDescription(type, id),
      });
    }
  }

  // Create the heated line sources with explicit typing
  const heatedLineSources: Record<HeatedLineSourceId, PlcModbusSource> =
    {} as Record<HeatedLineSourceId, PlcModbusSource>;
  for (const id of anybusConfig.heatedLine.ids) {
    const sourceId = `HTDL.${id}` as HeatedLineSourceId;
    heatedLineSources[sourceId] = getModbusConfigBase({
      id: sourceId,
      host: anybusConfig.heatedLine.host,
      description: anybusConfig.heatedLine.descriptions[id],
    });
  }

  // The spread will preserve the literal types
  return {
    ...regenSources,
    ...heatedLineSources,
  };
};
