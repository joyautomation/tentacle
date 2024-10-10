import { existsSync } from "@std/fs";
import type { Variable } from "./types.ts";
import { copy, exists } from "@std/fs";
import { join } from "@std/path";
import { logs } from "./log.ts";
const { main: log } = logs;

function importFresh(modulePath: string) {
  // Resolve the full path of the module
  // const resolvedPath = require.resolve(modulePath);

  // Delete the module from the cache
  // delete require.cache[resolvedPath];

  // Dynamically import the module, which should now bypass the cache
  return import(`${modulePath}?update=${Date.now()}`);
}

export async function createDefaultFiles() {
  const defaultConfig = {
    tasks: {
      main: {
        description: "The main task",
        scanRate: 2500,
        program: "main",
      },
    },
  };
  32;
  const defaultVariables: { [key: string]: Variable } = {
    count: {
      id: "count",
      datatype: "number",
      description: "A counter",
      default: 0,
      persistent: true,
    },
  };
  const mainProgram = `export function main(
  variables: { [key: string]: boolean | number | string | null },
) {
  variables.count = variables?.count || 0 + 1;
}`;
  const files = [
    {
      path: "variables.ts",
      content:
        `import { variables as defaultVariables } from "./variables/example.ts";
export const variables = {...exampleVariables}`,
    },
    {
      path: "variables/default.ts",
      content: `export const variables = ${
        JSON.stringify(defaultVariables, null, 2)
      }`,
    },
    {
      path: "program/main.ts",
      content: mainProgram,
    },
    {
      path: "config.ts",
      content: `export const config = ${
        JSON.stringify(defaultConfig, null, 2)
      }`,
    },
  ];
  await Promise.all(files.map((file) => {
    const path = `./development/${file.path}`;
    const pathDir = path.substring(0, path.lastIndexOf("/"));
    Deno.mkdirSync(pathDir, { recursive: true });
    return Deno.writeTextFile(
      path,
      file.content,
      { createNew: true },
    ).catch((error) => {
      if (error.name === "AlreadyExists") {
        log.info(`${path} already exists`);
      } else {
        log.error(`Error creating ${path}: ${error.trace}`);
      }
    });
  }));
}

export function validateDevelopmentConfigFilesExist() {
  const paths = [
    ["development"],
    ["development", "config.ts"],
    ["development", "variables.ts"],
  ];
  return paths.forEach((pathParts) => {
    const path = join(Deno.cwd(), ...pathParts);
    if (!existsSync(path)) {
      throw new Error(`${path} does not exist.`);
    }
  });
}

export async function validateDevelopment() {
  if (existsSync("./development")) {
    validateDevelopmentConfigFilesExist();
    const { config } = await importFresh("./development/config.ts");
    if (config == null) {
      throw new Error(
        "./development/config.ts does not export a symbol named config.",
      );
    }
    const { variables } = await importFresh("./development/variables.ts");
    if (variables == null) {
      throw new Error(
        "./development/variables.ts does not export a symbol named variables.",
      );
    }
  }
}

export async function createRuntime() {
  await copy("./development", "./runtime", { overwrite: true });
}

export async function getPlcConfig() {
  const configPath = join(Deno.cwd(), "runtime", "config.ts");
  if (existsSync(configPath)) {
    const config = await import(configPath);
    return config.config;
  } else {
    throw new Error("./runtime/config.ts does not exist.");
  }
}

export function createPlc() {
  createDefaultFiles();
}
