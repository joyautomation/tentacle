// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./index.ts"],
  importMap: "./deno.json",
  outDir: "./npm",
  typeCheck: "both",
  filterDiagnostic(diagnostic) {
    return diagnostic.code !== 7016;
  },
  test: false,
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@joyautomation/tentacle",
    version: Deno.args[0],
    description: "Tentacle is a modern soft PLC",
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/joyautomation/tentacle.git",
    },
    bugs: {
      url: "https://github.com/joyautomation/tentacle/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
