import type { PlcVariableSourceRuntimeBase } from "./sources.ts";
import type {
  PlcVariableBooleanRuntimeWithRestSource,
  PlcVariableNumberRuntimeWithRestSource,
  PlcVariableStringRuntimeWithRestSource,
} from "./variables.ts";

/**
 * Configuration for a REST-based variable source.
 *
 * @template T - The type of the variable value
 */
export type RestVariableSource = {
  /** The type identifier for REST sources */
  type: "rest";
  /** The URL endpoint to make requests to */
  url: string;
  /** The rate at which to poll the endpoint (in milliseconds) */
  rate: number;
  /** The HTTP method to use for requests */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** HTTP headers to include in the request */
  headers: Record<string, string>;
  /** Function to generate the request body based on the current value */
  body: (value: number | boolean | string) => string;
  /** Optional callback to transform the response before setting the value */
  onResponse?: (
    //TODO: tighten this up later
    // deno-lint-ignore no-explicit-any
    value: any,
    variable:
      | PlcVariableNumberRuntimeWithRestSource
      | PlcVariableBooleanRuntimeWithRestSource
      | PlcVariableStringRuntimeWithRestSource,
  ) => number | boolean | string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether to update the variable value from the response */
  setFromResponse: boolean;
};

/**
 * Runtime representation of a REST-based variable source.
 *
 * @template T - The type of the variable value
 */
export type PlcVariableRestSourceRuntime =
  & PlcVariableSourceRuntimeBase
  & RestVariableSource;

/**
 * Type that includes a REST source configuration.
 *
 * @template T - The type of the variable value
 */
export type WithRestSource = {
  source: RestVariableSource;
};

/**
 * Runtime type that includes a REST source configuration.
 *
 * @template T - The type of the variable value
 */
export type WithRestSourceRuntime = WithRestSource;

/**
 * Type guard function that checks if a given source is a RestVariableSource.
 *
 * @template T - The type of the variable value
 * @param {unknown} source - The source object to check
 * @returns {source is RestVariableSource<T>} - Returns true if the source is a valid RestVariableSource, false otherwise
 *
 * @description
 * This function performs runtime type checking to verify if an object matches the structure
 * of a RestVariableSource. It checks for the presence of the type property and validates
 * that it equals "rest".
 */
export const isSourceRest = (
  source: unknown,
): source is RestVariableSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  source.type === "rest";

/**
 * Type guard function that checks if a given source is a PlcVariableRestSourceRuntime.
 *
 * @template T - The type of the variable value
 * @param {unknown} source - The source object to check
 * @returns {source is PlcVariableRestSourceRuntime<T>} - Returns true if the source is a valid PlcVariableRestSourceRuntime, false otherwise
 *
 * @description
 * This function performs runtime type checking to verify if an object matches the structure
 * of a PlcVariableRestSourceRuntime. It checks for the presence of required properties
 * and validates that the type property equals "rest".
 */
export const isVariableRestSourceRuntime = (
  source: unknown,
): source is PlcVariableRestSourceRuntime => {
  if (
    typeof source === "object" &&
    source !== null &&
    "type" in source &&
    "url" in source &&
    "rate" in source &&
    "method" in source &&
    "headers" in source &&
    "body" in source &&
    "onResponse" in source &&
    "timeout" in source &&
    "setFromResponse" in source
  ) {
    const { type } = source as {
      type: string;
    };
    return type === "rest";
  }
  return false;
};
