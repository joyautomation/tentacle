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
const log = logs.main;

export const someTrue = (...values: boolean[]): boolean =>
  values.some((value) => value === true);

export const createModbusClient = () => {
  return new ModbusRTU.default();
};

export function createModbus(
  config: ModbusCreateInput,
): Promise<Modbus> {
  const client = new ModbusRTU.default();
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
    await modbus.client.connectTCP(modbus.host, { port: modbus.port }).catch(
      (error) => {
        const message = `Error connecting to modbus: ${error.trace}`;
        log.error(message);
        setModbusStateErrored(modbus, message);
      },
    );
    return setModbusStateConnected(modbus);
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
};

const resetModbusState = (modbus: Modbus) => {
  modbus.states = {
    connected: false,
    disconnected: false,
    errored: false,
  };
  return modbus;
};

const deriveSetModbusState = (state: Partial<Modbus["states"]>) =>
  pipe(
    resetModbusState,
    setStateCurry<Modbus, Modbus["states"]>(state),
  );

const setModbusStateConnected = deriveSetModbusState({ connected: true });
const setModbusStateDisconnected = deriveSetModbusState({ disconnected: true });
const setModbusStateErrored = (modbus: Modbus, message: string) => {
  modbus.lastError = message;
  return deriveSetModbusState({ errored: true })(modbus);
};

async function changeModbusState(
  inRequiredState: (modbus: Modbus) => boolean,
  notInRequiredStateLogText: string,
  transition: ModbusTransition,
  modbus: Modbus,
) {
  if (!inRequiredState(modbus)) {
    log.info(
      `${notInRequiredStateLogText}, it is currently: ${
        getModbusStateString(
          modbus,
        )
      }`,
    );
  } else {
    log.info(
      `Node ${modbus.id} transitioning from ${
        getModbusStateString(
          modbus,
        )
      } to ${transition}`,
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
  (modbus: Modbus) => modbus.states.disconnected,
  "Modbus needs to be disconnected to be connected",
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

export async function readModbus(
  register: number,
  registerType: ModbusRegisterType,
  format: ModbusFormat,
  modbus: Modbus,
) {
  if (!modbus.states.connected) {
    const message = `Cannot read modbus: Not connected (State: ${
      getModbusStateString(modbus)
    })`;
    log.error(message);
    throw new Error(message);
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
      ? readModbusFormatValue(result, format, modbus)
      : result.data[0];
  } catch (error) {
    const message = `Error reading modbus: ${
      error instanceof Error ? error.message : error
    }`;
    log.error(message);
    setModbusStateErrored(modbus, message);
    throw error;
  }
}
