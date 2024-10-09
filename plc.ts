import { existsSync } from "@std/fs";
import type { Variable } from "./types.ts";
import { logs } from "./log.ts";
const { main: log } = logs;

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
