import ModbusRTU from "modbus-serial";
import { EventEmitter } from "node:events";
import { logs } from "../log.ts";
import { pipe } from "ramda";
import { Modbus, ModbusCreateInput } from "./types.ts";
import { ModbusTransition } from "./types.ts";
import { ModbusClient } from "./types.ts";
import { ModbusRegisterType } from "./types.ts";
import { ModbusFormat } from "./types.ts";
import { ReadRegisterResult } from "./types.ts";
import { ReadCoilResult } from "./types.ts";
import {
  createFail,
  createSuccess,
  ResultFail,
} from "@joyautomation/dark-matter";
const log = logs.main;

export const _internals = {
  ModbusRTU,
};

export const someTrue = (...values: boolean[]): boolean =>
  values.some((value) => value === true);

export const createModbusClient = () => {
  return new _internals.ModbusRTU.default();
};

export function createModbus(config: ModbusCreateInput): Promise<Modbus> {
  const client = createModbusClient();
  client.setID(config.unitId);
  const modbus = {
    ...config,
    client,
    states: {
      connected: false,
      disconnected: true,
      errored: false,
    },
    events: new EventEmitter(),
    lastError: null,
    retryCount: 0,
    retryTimeout: null,
    retryMinDelay: config.retryMinDelay || 1000, // 1 second
    retryMaxDelay: config.retryMaxDelay || 60000, // 1 minute maximum delay
  };
  return connectModbus(modbus);
}

export const getModbusStateString = (modbus: Modbus) => {
  if (modbus.states.errored) {
    return "errored";
  } else if (modbus.states.disconnected) {
    return "disconnected";
  } else if (modbus.states.connected) {
    return "connected";
  } else {
    return `unknown state: ${JSON.stringify(modbus.states)}`;
  }
};

export const setState = <U extends { states: T }, T>(
  state: Partial<T>,
  entity: U
): U => {
  entity.states = { ...entity.states, ...state };
  return entity;
};

export const setStateCurry =
  <U extends { states: T }, T>(state: Partial<T>) =>
  (entity: U): U =>
    setState(state, entity);

export const modbusTransitions = {
  connect: async (modbus: Modbus) => {
    try {
      await modbus.client.connectTCP(modbus.host, { port: modbus.port });
      return setModbusStateConnected(modbus);
    } catch (error) {
      const message = `Error connecting to modbus: ${
        isModbusError(error) ? error.message : JSON.stringify(error)
      }`;
      log.error(message);
      return failModbus(modbus, message);
    }
  },
  disconnect: async (modbus: Modbus) => {
    await new Promise<void>((resolve) =>
      modbus.client.close(() => {
        console.log("disconnected");
        resolve();
      })
    );
    setModbusStateDisconnected(modbus);
    return modbus;
  },
  errored: (modbus: Modbus) => {
    setModbusStateErrored(modbus);
    onErrored(modbus);
    return modbus;
  },
};

const setModbusState = (state: Partial<Modbus["states"]>, modbus: Modbus) => {
  modbus.states = {
    connected: false,
    disconnected: false,
    errored: false,
    ...state,
  };
  return modbus;
};

const setModbusStateConnected = (modbus: Modbus) => {
  modbus.retryCount = 0; // Reset retry count on successful connection
  return setModbusState({ connected: true }, modbus);
};

const setModbusStateDisconnected = (modbus: Modbus) =>
  setModbusState({ disconnected: true }, modbus);

const setModbusStateErrored = (modbus: Modbus) =>
  setModbusState({ errored: true }, modbus);

const onErrored = (modbus: Modbus) => {
  setModbusStateErrored(modbus);

  if (modbus.retryTimeout) {
    clearTimeout(modbus.retryTimeout);
  }

  const currentRetry = modbus.retryCount + 1;
  const delay = Math.min(
    modbus.retryMinDelay * Math.pow(2, modbus.retryCount),
    modbus.retryMaxDelay
  );

  modbus.retryTimeout = setTimeout(async () => {
    modbus.retryCount = currentRetry;
    log.info(
      `Attempting reconnection (attempt ${currentRetry}, delay was: ${delay}ms)`
    );
    try {
      await connectModbus(modbus);
    } catch (error) {
      log.error(
        `Reconnection attempt failed: ${createModbusErrorString(error)}`
      );
      // Recursively call setModbusStateErrored to continue retrying
      failModbus(modbus, createModbusErrorString(error));
    }
  }, delay);

  return modbus;
};

async function changeModbusState(
  inRequiredState: (modbus: Modbus) => boolean,
  notInRequiredStateLogText: string,
  transition: ModbusTransition,
  modbus: Modbus
) {
  if (!inRequiredState(modbus)) {
    log.info(
      `${notInRequiredStateLogText}, it is currently: ${getModbusStateString(
        modbus
      )}`
    );
  } else {
    log.info(
      `Node ${modbus.id} transitioning from ${getModbusStateString(
        modbus
      )} to ${transition}`
    );
    await modbusTransitions[transition](modbus);
  }
  return modbus;
}

const changeModbusStateCurry =
  (
    inRequiredState: (modbus: Modbus) => boolean,
    notInRequiredStateLogText: string,
    transition: ModbusTransition
  ) =>
  (modbus: Modbus) =>
    changeModbusState(
      inRequiredState,
      notInRequiredStateLogText,
      transition,
      modbus
    );

const connectModbus = changeModbusStateCurry(
  (modbus: Modbus) => modbus.states.disconnected || modbus.states.errored,
  "Modbus needs to be disconnected or errored to be connected",
  "connect"
);

/**
 * Disconnects a Sparkplug Modbus.
 * @param {Modbus} Modbus - The Sparkplug Modbus to disconnect.
 * @returns {Modbus} The disconnected Modbus.
 */
export const disconnectModbus = changeModbusStateCurry(
  (modbus: Modbus) => modbus.states.connected,
  "Modbus needs to be connected to be disconnected",
  "disconnect"
);

/**
 * Errors a Sparkplug Modbus.
 * @param {Modbus} Modbus - The Sparkplug Modbus to error.
 * @returns {Modbus} The errored Modbus.
 */
export const failModbus = (modbus: Modbus, error: string) => {
  modbus.lastError = error;
  return changeModbusStateCurry(
    () => true,
    "Modbus can fail from any state",
    "errored"
  )(modbus);
};

type ModbusReadFunctions = {
  HOLDING_REGISTER: ModbusClient["readHoldingRegisters"];
  INPUT_REGISTER: ModbusClient["readInputRegisters"];
  COIL: ModbusClient["readCoils"];
  DISCRETE_INPUT: ModbusClient["readDiscreteInputs"];
};

function getRegisterQuantity(
  registerType: ModbusRegisterType,
  format: ModbusFormat
) {
  return ["HOLDING_REGISTER", "INPUT_REGISTER"].includes(registerType) &&
    ["UINT32", "INT32", "FLOAT", "DOUBLE"].includes(format)
    ? 2
    : 1;
}

function isReadRegisterResult(
  result: ReadRegisterResult | ReadCoilResult
): result is ReadRegisterResult {
  return Array.isArray(result.data) && typeof result.data[0] === "number";
}

function readModbusFormatValue(
  result: ReadRegisterResult,
  format: ModbusFormat,
  modbus: Modbus
): number {
  const { data } = result;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  if (format === "INT16") {
    view.setInt16(0, data[0], modbus.reverseBits);
    return view.getInt16(0, modbus.reverseBits);
  } else if (format === "INT32") {
    view.setInt16(
      0,
      modbus.reverseWords ? data[1] : data[0],
      modbus.reverseBits
    );
    view.setInt16(
      2,
      modbus.reverseWords ? data[0] : data[1],
      modbus.reverseBits
    );
    return view.getInt32(0, modbus.reverseBits);
  } else if (format === "FLOAT") {
    view.setInt16(
      0,
      modbus.reverseWords ? data[1] : data[0],
      modbus.reverseBits
    );
    view.setInt16(
      2,
      modbus.reverseWords ? data[0] : data[1],
      modbus.reverseBits
    );
    return view.getFloat32(0, modbus.reverseBits);
  }

  throw new Error(`Unsupported format: ${format}`);
}

export type ModbusError = {
  name: string;
  message: string;
  errno: string;
};

export function isModbusError(error: unknown): error is ModbusError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    "message" in error &&
    "errno" in error
  );
}

export const createModbusErrorString = (error: unknown, context = ""): string =>
  `${context}${isModbusError(error) ? error.message : String(error)}`;

export const createModbusErrorProperties = (
  error: unknown,
  context = ""
): Omit<ResultFail, "success"> & { context: string } => ({
  error: createModbusErrorString(error, context),
  context,
  message: isModbusError(error) ? error.message : undefined,
  name: isModbusError(error) ? error.name : undefined,
});

export async function readModbus(
  register: number,
  registerType: ModbusRegisterType,
  format: ModbusFormat,
  modbus: Modbus
) {
  if (!modbus.states.connected) {
    return createFail(
      `Cannot read modbus: Not connected (State: ${getModbusStateString(
        modbus
      )})`
    );
  }

  const quantity = getRegisterQuantity(registerType, format);
  const functionMap: ModbusReadFunctions = {
    HOLDING_REGISTER: modbus.client.readHoldingRegisters.bind(modbus.client),
    INPUT_REGISTER: modbus.client.readInputRegisters.bind(modbus.client),
    COIL: modbus.client.readCoils.bind(modbus.client),
    DISCRETE_INPUT: modbus.client.readDiscreteInputs.bind(modbus.client),
  };

  try {
    const result = await functionMap[registerType](register, quantity);
    return isReadRegisterResult(result)
      ? createSuccess(readModbusFormatValue(result, format, modbus))
      : createSuccess(result.data[0]);
  } catch (error) {
    console.log(JSON.stringify(error));
    const errorProps = createModbusErrorProperties(error);
    failModbus(modbus, errorProps.error);
    return createFail(errorProps);
  }
}
