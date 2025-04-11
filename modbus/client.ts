import ModbusRTU from "modbus-serial";
import { EventEmitter } from "node:events";
import { logs } from "../log.ts";
import type { Modbus, ModbusCreateInput } from "./types.ts";
import type { ModbusTransition } from "./types.ts";
import type { ModbusClient } from "./types.ts";
import type { ModbusRegisterType } from "./types.ts";
import type { ModbusFormat } from "./types.ts";
import type { ReadRegisterResult } from "./types.ts";
import type { ReadCoilResult } from "./types.ts";
import type { ExtendedTcpPortOptions } from "./types.ts"; // Add this line
import {
  createErrorProperties,
  createFail,
  createSuccess,
  isFail,
  isSuccess,
  type Result,
  type ResultFail,
} from "@joyautomation/dark-matter";
const log = logs.main;

export const _internals = {
  ModbusRTU,
};

export const someTrue = (...values: boolean[]): boolean =>
  values.some((value) => value === true);

/**
 * Creates a new Modbus RTU client instance.
 * This is used internally to create the client for Modbus communication.
 * @returns {ModbusRTU.default} A new Modbus RTU client instance
 * @public
 */
export const createModbusClient = (): ModbusRTU.default => {
  return new _internals.ModbusRTU.default();
};

export function createModbus(
  config: ModbusCreateInput,
  onFail: (
    error: ReturnType<typeof createModbusErrorProperties>,
  ) => void = () => {},
  onConnect: () => void = () => {},
  onDisconnect: () => void = () => {},
  initialState: ModbusTransition = "connect",
): Promise<Modbus> {
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
  // Add default error listener to prevent uncaught exceptions
  modbus.events.on("error", (error) => {
    log.warn(`Modbus error event: ${error}`);
  });
  modbus.events.on("fail", (error) => {
    onFail(error);
  });
  modbus.events.on("connect", () => {
    onConnect();
  });
  modbus.events.on("disconnect", () => {
    onDisconnect();
  });
  return initialState === "connect"
    ? connectModbus(modbus)
    : Promise.resolve(modbus);
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
  entity: U,
): U => {
  entity.states = { ...entity.states, ...state };
  return entity;
};

export const setStateCurry =
  <U extends { states: T }, T>(state: Partial<T>) => (entity: U): U =>
    setState(state, entity);

export const modbusTransitions = {
  connect: async (modbus: Modbus) => {
    try {
      // @ts-ignore timeout is supported by modbus-serial but not typed
      await modbus.client.connectTCP(modbus.host, {
        port: modbus.port,
        timeout: modbus.timeout ?? 3000,
      } as ExtendedTcpPortOptions);
      setModbusStateConnected(modbus);
      modbus.events.emit("connect");
      return modbus;
    } catch (error) {
      const errorProps = isModbusError(error)
        ? createModbusErrorProperties(error)
        : createErrorProperties(error);
      const message =
        `Error connecting to modbus ${modbus.id}: ${errorProps.message}`;
      log.warn(message);
      return failModbus(modbus, errorProps);
    }
  },
  disconnect: async (modbus: Modbus) => {
    await new Promise<void>((resolve) =>
      modbus.client.close(() => {
        resolve();
      })
    );

    setModbusStateDisconnected(modbus);
    modbus.events.emit("disconnect");
    return modbus;
  },
  fail: (modbus: Modbus) => {
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
    modbus.retryMaxDelay,
  );

  modbus.retryTimeout = setTimeout(async () => {
    modbus.retryCount = currentRetry;
    log.info(
      `Attempting reconnection (attempt ${currentRetry}, delay was: ${delay}ms)`,
    );
    try {
      await connectModbus(modbus);
    } catch (error) {
      log.warn(
        `Reconnection attempt failed: ${createModbusErrorString(error)}`,
      );
      // Recursively call setModbusStateErrored to continue retrying
      failModbus(modbus, createModbusErrorProperties(error));
    }
  }, delay);

  return modbus;
};

async function changeModbusState(
  inRequiredState: (modbus: Modbus) => boolean,
  notInRequiredStateLogText: string,
  transition: ModbusTransition,
  modbus: Modbus,
) {
  if (!inRequiredState(modbus)) {
    log.warn(
      `${notInRequiredStateLogText}, it is currently: ${
        getModbusStateString(
          modbus,
        )
      }`,
    );
  } else {
    log.info(
      `Node ${modbus.id} making ${transition} transition from ${
        getModbusStateString(modbus)
      }`,
    );
    await modbusTransitions[transition](modbus);
  }
  return modbus;
}

const changeModbusStateCurry = (
  inRequiredState: (modbus: Modbus) => boolean,
  notInRequiredStateLogText: string,
  transition: ModbusTransition,
) =>
(modbus: Modbus) =>
  changeModbusState(
    inRequiredState,
    notInRequiredStateLogText,
    transition,
    modbus,
  );

const connectModbus = changeModbusStateCurry(
  (modbus: Modbus) => modbus.states.disconnected || modbus.states.errored,
  "Modbus needs to be disconnected or errored to be connected",
  "connect",
);

/**
 * Disconnects a Sparkplug Modbus.
 * @param {Modbus} Modbus - The Sparkplug Modbus to disconnect.
 * @returns {Modbus} The disconnected Modbus.
 */
export const disconnectModbus = changeModbusStateCurry(
  (modbus: Modbus) => modbus.states.connected,
  "Modbus needs to be connected to be disconnected",
  "disconnect",
);

/**
 * Errors a Sparkplug Modbus.
 * @param {Modbus} Modbus - The Sparkplug Modbus to error.
 * @returns {Modbus} The errored Modbus.
 */
export const failModbus = (
  modbus: Modbus,
  error: ReturnType<typeof createModbusErrorProperties>,
) => {
  modbus.lastError = {
    ...error,
    timestamp: new Date(),
  };
  modbus.events.emit("fail", error);
  return changeModbusStateCurry(
    () => true,
    "Modbus can fail from any state",
    "fail",
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
  format: ModbusFormat,
) {
  return ["HOLDING_REGISTER", "INPUT_REGISTER"].includes(registerType) &&
      ["UINT32", "INT32", "FLOAT", "DOUBLE"].includes(format)
    ? 2
    : 1;
}

function isReadRegisterResult(
  result: ReadRegisterResult | ReadCoilResult,
): result is ReadRegisterResult {
  return Array.isArray(result.data) && typeof result.data[0] === "number";
}

function readModbusFormatValue(
  result: ReadRegisterResult,
  format: ModbusFormat,
  modbus: Modbus,
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
      modbus.reverseBits,
    );
    view.setInt16(
      2,
      modbus.reverseWords ? data[0] : data[1],
      modbus.reverseBits,
    );
    return view.getInt32(0, modbus.reverseBits);
  } else if (format === "FLOAT") {
    view.setInt16(
      0,
      modbus.reverseWords ? data[1] : data[0],
      modbus.reverseBits,
    );
    view.setInt16(
      2,
      modbus.reverseWords ? data[0] : data[1],
      modbus.reverseBits,
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

/**
 * Creates error properties for Modbus errors in a format compatible with dark-matter's Result type.
 * @param {unknown} error - The error object to process
 * @param {string} [context=""] - Additional context to add to the error message
 * @returns {Object} Error properties including error message, context, and optional name/message fields
 * @public
 */
export const createModbusErrorProperties = (
  error: unknown,
  context = "",
): Omit<ResultFail, "success"> & { context: string } => ({
  error: createModbusErrorString(error, context),
  context,
  message: isModbusError(error) ? error.message : undefined,
  name: isModbusError(error) ? error.name : undefined,
});

const timeoutPromise = (ms: number): Promise<ResultFail> =>
  new Promise((resolve) => {
    setTimeout(
      () => resolve(createFail(`Modbus request timed out after ${ms}ms`)),
      ms,
    );
  });

export async function readModbus(
  register: number,
  registerType: ModbusRegisterType,
  format: ModbusFormat,
  modbus: Modbus,
): Promise<Result<number | boolean>> {
  if (!modbus.states.connected) {
    return createFail(
      `Cannot read modbus: Not connected (State: ${
        getModbusStateString(
          modbus,
        )
      })`,
    );
  }

  const quantity = getRegisterQuantity(registerType, format);
  const functionMap: ModbusReadFunctions = {
    HOLDING_REGISTER: modbus.client.readHoldingRegisters.bind(modbus.client),
    INPUT_REGISTER: modbus.client.readInputRegisters.bind(modbus.client),
    COIL: modbus.client.readCoils.bind(modbus.client),
    DISCRETE_INPUT: modbus.client.readDiscreteInputs.bind(modbus.client),
  };

  const result = await Promise.race([
    functionMap[registerType](register, quantity)
      .then((result) => createSuccess(result))
      .catch((error) => createFail(error)),
    timeoutPromise(3000),
  ]);

  if (isFail(result)) {
    return result;
  }
  if (isSuccess(result)) {
    return isReadRegisterResult(result.output)
      ? createSuccess(readModbusFormatValue(result.output, format, modbus))
      : createSuccess(result.output.data[0]);
  }
  return createFail("Unknown result type");
}
