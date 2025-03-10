import { Modbus, ModbusCreateInput } from "./types.ts";
import { createModbus, disconnectModbus, readModbus } from "./client.ts";

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

let interval: ReturnType<typeof setInterval> | null = null;
// Handle cleanup on SIGINT (Ctrl+C)
const cleanup = async (modbus: Modbus) => {
  console.log("\nCleaning up...");
  await disconnectModbus(modbus);
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  Deno.exit(0);
};

try {
  console.log("Creating Modbus connection...");
  const modbus = await createModbus(config);
  console.log("Modbus connected! Press Ctrl+C to exit.");

  interval = setInterval(async () => {
    if (modbus.states.connected) {
      const value = await readModbus(
        0,
        Modbus.RegisterTypes.INPUT_REGISTER,
        Modbus.Formats.INT16,
        modbus,
      );
      console.log(value);
    }
  }, 1000);

  // Set up cleanup handler
  Deno.addSignalListener("SIGINT", () => cleanup(modbus));

  // Keep the process alive
  await new Promise(() => {}); // Never resolves
} catch (error) {
  console.error("Failed to create modbus connection:", error);
}
