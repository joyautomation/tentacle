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

export type RestVariableSourceRuntime = RestVariableSource & {
  error: {
    error: string | null;
    message?: string | null;
    stack?: string | null;
    timestamp: Date;
  } | null;
};

export type WithRestSource = {
  source: RestVariableSource;
};

export type WithRestSourceRuntime = WithRestSource;

export const isSourceRest = (source: unknown): source is RestVariableSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  source.type === "rest";
