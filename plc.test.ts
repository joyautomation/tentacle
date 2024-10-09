import { describe, it } from "@std/testing/bdd";
import { assertSpyCalls, stub } from "@std/testing/mock";
import { createDefaultFiles } from "./plc.ts";

describe("plc", () => {
  it("should create default files", async () => {
    using writeTextFileStub = stub(Deno, "writeTextFile", async () => {});
    await createDefaultFiles();
    assertSpyCalls(writeTextFileStub, 4);
  });
  it("should just log info if files already exist", async () => {
    const infoStub = stub(console, "info");
    using writeTextFileStub = stub(Deno, "writeTextFile", async () => {
      const error = new Error("File already exists");
      error.name = "AlreadyExists";
      throw error;
    });
    await createDefaultFiles();
    assertSpyCalls(infoStub, 4);
    assertSpyCalls(writeTextFileStub, 4);
  });
  it("should create log errors if files already exist", async () => {
    const errorStub = stub(console, "error");
    using writeTextFileStub = stub(Deno, "writeTextFile", async () => {
      throw new Error("A big fat error.");
    });
    await createDefaultFiles();
    assertSpyCalls(errorStub, 4);
    assertSpyCalls(writeTextFileStub, 4);
  });
});
