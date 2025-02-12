import { join } from "@std/path";
import { PlcConfig, PlcTask, Variable } from "../types.ts";
import { failure, Result, success } from "../utils/result.ts";
import { existsSync } from "@std/fs";
import { importFresh } from "../utils/importFresh.ts";

export const _internals = {
  existsSync,
  importFresh,
};

export interface ValidPlcConfig {
  config: PlcConfig;
  variables: Record<string, Variable>;
}

export function validateConfigFilesExist(
  environment: "development" | "runtime",
): Result<void, string> {
  const paths = [
    [environment],
    [environment, "config.ts"],
    [environment, "variables.ts"],
  ];
  for (const pathParts of paths) {
    const path = join(Deno.cwd(), ...pathParts);
    if (!_internals.existsSync(path)) {
      return failure(`${path} does not exist.`);
    }
  }
  return success();
}

export function validateConfigFilesExistCurry(
  environment: "development" | "runtime",
) {
  return () => validateConfigFilesExist(environment);
}

export async function validateExportedSymbol<T>(
  pathParts: string[],
  symbol: string,
): Promise<Result<T, string>> {
  const path = join(Deno.cwd(), ...pathParts);
  const module = await _internals.importFresh<T>(path).catch((error) => {
    return error;
  });
  if (module instanceof Error) {
    return failure(`Error importing ${path}: ${module.stack}`);
  }
  if (module?.[symbol] == null) {
    return failure(`${path} does not export a symbol named ${symbol}.`);
  }
  return success(module[symbol]);
}

export async function validateConfig(environment: "development" | "runtime") {
  const result = await validateExportedSymbol<PlcConfig>(
    [environment, "config.ts"],
    "config",
  );
  if (!result.success) {
    return result;
  }
  const { value: config } = result;
  if (!isPlcConfig(config)) {
    return failure(
      `Config is not a valid PLC config. Config: ${
        JSON.stringify(config, null, 2)
      }`,
    );
  }
  const tasksResult = validateTasks(environment, config.tasks);
  if (!tasksResult.success) {
    return tasksResult;
  }
  return success(config);
}

export function validateConfigCurry(environment: "development" | "runtime") {
  return () => validateConfig(environment);
}

export function validateVariables(environment: "development" | "runtime") {
  return validateExportedSymbol<Record<string, Variable>>(
    [environment, "variables.ts"],
    "variables",
  );
}

export function validateVariablesCurry(environment: "development" | "runtime") {
  return () => validateVariables(environment);
}

export function validateTasks(
  environment: "development" | "runtime",
  tasks: Record<string, PlcTask>,
): Result<true, string> {
  Object.entries(tasks).forEach(([taskName, task]) => {
    const path = join(
      Deno.cwd(),
      environment,
      "program",
      `${task.program}.ts`,
    );
    if (!_internals.existsSync(path)) {
      return failure(`${path} for task ${taskName} does not exist.`);
    }
  });
  return success(true);
}

export async function validate(environment: "development" | "runtime"): Promise<
  Result<ValidPlcConfig, string>
> {
  const validations: {
    key: keyof ValidPlcConfig | null;
    fn: () =>
      | Promise<Result<void | PlcConfig | Record<string, Variable>, string>>
      | Result<void, string>;
  }[] = [
    { key: null, fn: validateConfigFilesExistCurry(environment) },
    { key: "config", fn: validateConfigCurry(environment) },
    { key: "variables", fn: validateVariablesCurry(environment) },
  ];

  const results = {} as Partial<ValidPlcConfig>;

  for (const validation of validations) {
    const result = await validation.fn();
    if (!result.success) {
      return failure(result.error);
    }
    if (result.success) {
      if (isRecordOfVariables(result.value)) {
        results.variables = result.value;
      } else if (isPlcConfig(result.value)) {
        results.config = result.value;
      }
    }
  }
  const { config, variables } = results;
  if (config == null) {
    return failure("Config is undefined");
  }
  if (variables == null) {
    return failure("Variables are undefined");
  }
  return success({
    config,
    variables,
  });
}

export function isVariable(value: unknown): value is Variable {
  return typeof value === "object" && value != null && "id" in value;
}

export function isRecordOfVariables(
  value: unknown,
): value is Record<string, Variable> {
  return typeof value === "object" && value != null &&
    (Object.values(value).every(isVariable) ||
      Object.values(value).length === 0);
}

export function isPlcConfig(value: unknown): value is PlcConfig {
  return typeof value === "object" && value != null &&
    ["tasks", "mqtt", "modbus", "opcua"].every((key) => key in value);
}
