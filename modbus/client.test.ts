import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Modbus, ModbusCreateInput } from "./types.ts";
import { createModbus, disconnectModbus, readModbus } from "./client.ts";

describe("createModbus", () => {
  it("should create a modbus instance", async () => {
    const config: ModbusCreateInput = {
      id: "1",
      host: "10.3.37.143",
      port: 502,
      unitId: 1,
      reverseBits: false,
      reverseWords: false,
      retryMinDelay: 1000,
      retryMaxDelay: 60000,
    };
    const modbus = await createModbus(config);
    const value = await readModbus(
      0,
      Modbus.RegisterTypes.INPUT_REGISTER,
      Modbus.Formats.INT16,
      modbus,
    );
    expect(value).toBe(1);
    await disconnectModbus(modbus);
  });
});
