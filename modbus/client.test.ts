import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";
import { expect } from "@std/expect";
import { Modbus, ModbusCreateInput } from "./types.ts";
import { createModbus, disconnectModbus, readModbus } from "./client.ts";

describe("createModbus", () => {
  it("should create a modbus instance", async () => {
    const config: ModbusCreateInput = {
      id: "1",
      host: "10.154.92.80",
      port: 502,
      unitId: 1,
      reverseBits: false,
      reverseWords: false,
      zeroBased: false,
      retryRate: 1000,
      retryCount: 3,
    };
    const modbus = await createModbus(config);
    const value = await readModbus(
      0,
      Modbus.RegisterTypes.INPUT_REGISTER,
      Modbus.Formats.INT16,
      modbus,
    );
    expect(value).toBe(0);
    await disconnectModbus(modbus);
  });
});
