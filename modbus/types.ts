import type { EventEmitter } from "node:events";
import type {
  createModbusClient,
  createModbusErrorProperties,
} from "./client.ts";

export const Modbus = {
  RegisterTypes: {
    HOLDING_REGISTER: "HOLDING_REGISTER",
    INPUT_REGISTER: "INPUT_REGISTER",
    COIL: "COIL",
    DISCRETE_INPUT: "DISCRETE_INPUT",
  },
  Formats: {
    INT16: "INT16",
    INT32: "INT32",
    FLOAT: "FLOAT",
  },
} as const;

export type ModbusRegisterType = keyof typeof Modbus.RegisterTypes;
export type ModbusFormat = keyof typeof Modbus.Formats;

export type ModbusCreateInput = {
  id: string;
  host: string;
  port: number;
  unitId: number;
  reverseBits: boolean;
  reverseWords: boolean;
  retryMinDelay?: number;
  retryMaxDelay?: number;
};

export type Modbus = ModbusCreateInput & {
  client: ModbusClient;
  states: {
    connected: boolean;
    disconnected: boolean;
    errored: boolean;
  };
  events: EventEmitter;
  lastError: ReturnType<typeof createModbusErrorProperties> | null;
  retryTimeout: number | null;
  retryCount: number;
  retryMinDelay: number;
  retryMaxDelay: number;
};

export type ModbusClient = ReturnType<typeof createModbusClient>;
export type ReadRegisterResult = Awaited<
  ReturnType<ModbusClient["readHoldingRegisters"]>
>;
export type ReadCoilResult = Awaited<ReturnType<ModbusClient["readCoils"]>>;

export type ModbusTransition = "connect" | "disconnect" | "fail";

export type ModbusSourceParams = {
  format: ModbusFormat;
  register: number;
  registerType:
    | "HOLDING_REGISTER"
    | "INPUT_REGISTER"
    | "COIL"
    | "DISCRETE_INPUT";
};
