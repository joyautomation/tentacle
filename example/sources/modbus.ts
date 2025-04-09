import type { PlcModbusSource } from "../../types/sources.ts";

export const getModbusConfigBase = ({
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
  timeout: 3000,
  retryMinDelay: 1000,
  retryMaxDelay: 60000,
});
