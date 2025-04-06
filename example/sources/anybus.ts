import type { PlcModbusSource } from "../../types/sources.ts";
import { getModbusConfigBase } from "./modbus.ts";

export type AnybusRegenHeaterId = "A" | "B";
export type AnybusRegenHeaterType = "PID" | "OT";
export type AnybusHeatedLineId = "IN" | "OUT" | "2FTIR" | "2FID";

export type AnybusSources = {
  [K in `RGN.${AnybusRegenHeaterType}.${AnybusRegenHeaterId}`]: PlcModbusSource;
} & {
  [K in `HTDL.${AnybusHeatedLineId}`]: PlcModbusSource;
};

const anybusSourceConfig = {
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
      IN: "Heated Line Inlet",
      OUT: "Heated Line Outlet",
      "2FTIR": "Heated Line Sampl to FTIR",
      "2FID": "Heated Line FTIR to FID",
    } as const,
  },
} as const;

// Helper type to extract all possible regen source IDs
type RegenSourceId =
  `RGN.${(typeof anybusSourceConfig.regen.types)[number]}.${(typeof anybusSourceConfig.regen.ids)[number]}`;

// Helper type to extract all possible heated line source IDs
type HeatedLineSourceId =
  `HTDL.${(typeof anybusSourceConfig.heatedLine.ids)[number]}`;

export const getAnybusSources = (): AnybusSources => {
  // Create the regen sources with explicit typing
  const regenSources: Record<RegenSourceId, PlcModbusSource> =
    Object.fromEntries(
      anybusSourceConfig.regen.types.flatMap((type) =>
        anybusSourceConfig.regen.ids.map((id) => {
          const sourceId = `RGN.${type}.${id}` as RegenSourceId;
          return [
            sourceId,
            getModbusConfigBase({
              id: sourceId,
              host: anybusSourceConfig.regen.host,
              description: anybusSourceConfig.regen.getDescription(type, id),
            }),
          ];
        })
      )
    ) as Record<RegenSourceId, PlcModbusSource>;

  // Create the heated line sources with explicit typing
  const heatedLineSources: Record<HeatedLineSourceId, PlcModbusSource> =
    Object.fromEntries(
      anybusSourceConfig.heatedLine.ids.map((id) => [
        `HTDL.${id}` as HeatedLineSourceId,
        getModbusConfigBase({
          id: `HTDL.${id}`,
          host: anybusSourceConfig.heatedLine.host,
          description: anybusSourceConfig.heatedLine.descriptions[id],
        }),
      ])
    ) as Record<HeatedLineSourceId, PlcModbusSource>;

  // The spread will preserve the literal types
  return {
    ...regenSources,
    ...heatedLineSources,
  };
};

export const anybusSources = getAnybusSources();
