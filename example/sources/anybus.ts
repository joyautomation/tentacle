import { PlcModbusSource } from "../../types/sources.ts";

const anybusSources = {
  "192.168.20.10": [
    { id: "RGN.PID.A", description: "Regen A" },
    { id: "RGN.OT.A", description: "Regen OT A" },
    { id: "RGN.PID.B", description: "Regen B" },
    { id: "RGN.OT.B", description: "Regen OT B" },
  ],
  "192.168.20.40": [
    { id: "HTDL.IN", description: "Heated Line Inlet" },
    { id: "HTDL.OUT", description: "Heated Line Outlet" },
    { id: "HTDL.2FTIR", description: "Heated Line Sampl to FTIR" },
    { id: "HTDL.2FID", description: "Heated Line FTIR to FID" },
  ],
};

const generateAdamSources = (): AdamSources => {
  const sides: side[] = ["P", "S"];
  return Object.fromEntries() as AdamSources;
};

const anybusConfigBase = ({
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

export const anybusSources = generateAnybusSources();
