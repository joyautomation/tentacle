import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";
import { createDefaultFiles } from "./runtime.ts";
import { updateRuntime } from "./runtime.ts";
import { _internals } from "./runtime.ts";
import { _internals as _internalsValidation } from "./validation.ts";
import { expect } from "@std/expect";

describe("plc", () => {
  describe("createDefaultFiles", () => {
    it("should create default files", async () => {
      using mkdirSyncStub = stub(Deno, "mkdirSync", async () => {});
      using writeTextFileStub = stub(Deno, "writeTextFile", async () => {});
      await createDefaultFiles();
      assertSpyCalls(writeTextFileStub, 4);
      assertSpyCalls(mkdirSyncStub, 4);
    });
    it("should just log info if files already exist", async () => {
      using infoStub = stub(console, "info");
      using mkdirSyncStub = stub(Deno, "mkdirSync", async () => {});
      using writeTextFileStub = stub(Deno, "writeTextFile", async () => {
        const error = new Error("File already exists");
        error.name = "AlreadyExists";
        throw error;
      });
      await createDefaultFiles();
      assertSpyCalls(infoStub, 4);
      assertSpyCalls(writeTextFileStub, 4);
      assertSpyCalls(mkdirSyncStub, 4);
    });
    it("should create log errors if files already exist", async () => {
      using errorStub = stub(console, "error");
      using mkdirSyncStub = stub(Deno, "mkdirSync", async () => {});
      using writeTextFileStub = stub(Deno, "writeTextFile", async () => {
        throw new Error("A big fat error.");
      });
      await createDefaultFiles();
      assertSpyCalls(errorStub, 4);
      assertSpyCalls(writeTextFileStub, 4);
      assertSpyCalls(mkdirSyncStub, 4);
    });
  });
  describe("updateRuntime", () => {
    it("should create the runtime", async () => {
      using infoStub = stub(console, "info");
      using existsSyncStub = stub(
        _internalsValidation,
        "existsSync",
        () => true,
      );
      using importFreshStub = stub(
        _internalsValidation,
        "importFresh",
        (path) => {
          return path.includes("config.ts")
            ? Promise.resolve({
              config: {
                tasks: {},
                mqtt: {},
                modbus: {},
                opcua: {},
              },
            })
            : Promise.resolve({ variables: {} });
        },
      );
      using copyStub = stub(_internals, "copy");
      const result = await updateRuntime();
      assertSpyCall(copyStub, 0);
      assertSpyCall(existsSyncStub, 0);
      assertSpyCall(importFreshStub, 0);
      assertSpyCall(infoStub, 0);
      expect(result.success).toBe(true);
    });
  });
});
