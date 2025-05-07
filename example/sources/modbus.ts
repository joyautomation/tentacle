import type { PlcModbusSource } from "../../types/sources.ts";

export const getModbusConfigBase = ({
  id,
  host,
  description,
  reverseBits = false,
  reverseWords = false,
}: {
  id: string;
  description: string;
  host: string;
  reverseBits?: boolean;
  reverseWords?: boolean;
}): PlcModbusSource => ({
  id,
  description,
  type: "modbus",
  enabled: true,
  name: id,
  host,
  port: 502,
  unitId: 1,
  reverseBits,
  reverseWords,
  timeout: 3000,
  retryMinDelay: 1000,
  retryMaxDelay: 60000,
});
