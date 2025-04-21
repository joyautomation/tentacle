import { PlcVariableSourceRuntimeBase } from "./sources.ts";
import {
  PlcVariableBooleanRuntimeWithRestSource,
  PlcVariableNumberRuntimeWithRestSource,
  PlcVariableStringRuntimeWithRestSource,
} from "./variables.ts";

export type RestVariableSource = {
  type: "rest";
  url: string;
  rate: number;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers: Record<string, string>;
  body: (value: number | boolean | string) => string;
  onResponse?: (
    value: any,
    variable:
      | PlcVariableNumberRuntimeWithRestSource
      | PlcVariableBooleanRuntimeWithRestSource
      | PlcVariableStringRuntimeWithRestSource,
  ) => number | boolean | string;
  timeout: number;
  setFromResponse: boolean;
};

export type PlcVariableRestSourceRuntime =
  & PlcVariableSourceRuntimeBase
  & RestVariableSource;

export type WithRestSource = {
  source: RestVariableSource;
};

export type WithRestSourceRuntime = WithRestSource;

export const isSourceRest = (source: unknown): source is RestVariableSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  source.type === "rest";

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
