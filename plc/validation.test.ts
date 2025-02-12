import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { validate, validateConfigFilesExist } from "./validation.ts";
import { _internals } from "./validation.ts";
import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";

describe("validateConfigFilesExist", () => {
  it("should return a success result if the files exist", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    const result = await validateConfigFilesExist("development");
    expect(result.success).toBe(true);
    assertSpyCall(existsSyncStub, 0);
  });
  it("should return a failure result if a file does not exist", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => false);
    const result = await validateConfigFilesExist("development");
    expect(result.success).toBe(false);
    assertSpyCalls(existsSyncStub, 1); // Should short circuit after the first failure
  });
});
describe("validate", () => {
  it("should return a success result if files exist and return valid config/variables for config.ts and variables.ts respectively", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    using importFreshStub = stub(_internals, "importFresh", (path) => {
      return path.includes("variables.ts")
        ? Promise.resolve({ variables: {} })
        : Promise.resolve({
          config: { tasks: {}, mqtt: {}, modbus: {}, opcua: {} },
        });
    });
    const result = await validate("development");
    expect(result.success).toBe(true);
    assertSpyCall(existsSyncStub, 0);
    assertSpyCall(importFreshStub, 0);
  });
  it("should return a failure result if a file does not exist", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => false);
    const result = await validate("development");
    expect(result.success).toBe(false);
    assertSpyCalls(existsSyncStub, 1);
  });
  it("should return a failure result if there is an error in the imported modules", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    using importFreshStub = stub(_internals, "importFresh", () => {
      return new Promise(() => {
        throw new Error("A big fat error.");
      });
    });
    const result = await validate("development");
    expect(result.success).toBe(false);
    assertSpyCall(existsSyncStub, 0);
    assertSpyCall(importFreshStub, 0);
  });
  it("should return a failure if the config.ts file does not export a config object", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    using importFreshStub = stub(_internals, "importFresh", (path) => {
      return path.includes("variables.ts")
        ? Promise.resolve({ variables: {} })
        : Promise.resolve({});
    });
    const result = await validate("development");
    expect(result.success).toBe(false);
    assertSpyCall(existsSyncStub, 0);
    assertSpyCall(importFreshStub, 0);
  });
  it("should return a failure if config.ts doesn't have the right properties", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    using importFreshStub = stub(_internals, "importFresh", (path) => {
      return path.includes("config.ts")
        ? Promise.resolve({
          config: { mqtt: {}, modbus: {}, opcua: {} },
        })
        : Promise.resolve({});
    });
    const result = await validate("development");
    expect(result.success).toBe(false);
    assertSpyCall(existsSyncStub, 0);
    assertSpyCall(importFreshStub, 0);
  });
  it("should return a failure if the variables.ts file does not export a variables object", async () => {
    using existsSyncStub = stub(_internals, "existsSync", () => true);
    using importFreshStub = stub(_internals, "importFresh", (path) => {
      return path.includes("config.ts")
        ? Promise.resolve({
          config: { tasks: {}, mqtt: {}, modbus: {}, opcua: {} },
        })
        : Promise.resolve({});
    });
    const result = await validate("development");
    expect(result.success).toBe(false);
    assertSpyCall(existsSyncStub, 0);
    assertSpyCall(importFreshStub, 0);
  });
});
