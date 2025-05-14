import type { PlcVariables, PlcVariablesRuntime } from "../../../types/variables.ts";
import type { PlcSources } from "../../../types/sources.ts";
import { hasFr202Source, isVariableBooleanWithFr202DiscreteInputSource, isVariableNumberWithFr202AnalogInputSource } from "./types.ts";
import type { PlcMqtts } from "../../../types/mqtt.ts";
import { adcReadMilliamps, dioGetOnePinStatus } from "./io.ts";
import { updateRuntimeValue } from "../../../plc/runtime.ts";
import type { Plc } from "../../../types/types.ts";

export const getFr202Rates = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(
  variables: PlcVariablesRuntime<M, S, V>
) =>
  Object.values(variables)
    .filter((variable) => hasFr202Source(variable))
    .reduce((acc: Record<string, PlcVariablesRuntime<M, S, V>>, variable) => {
      if (!acc[`${variable.source.rate}`]) {
        acc[`${variable.source.rate}`] = Object.fromEntries(
          Object.entries(variables).filter(
            ([_, v]) =>
              hasFr202Source(v) && v.source.rate === variable.source.rate
          )
        ) as PlcVariablesRuntime<M, S, V>;
      }
      return acc;
    }, {} as Record<string, PlcVariablesRuntime<M, S, V>>);

export const startFr202Intervals = <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) => {
  const rates = getFr202Rates(plc.runtime.variables);
  const intervals = Object.fromEntries(Object.entries(rates).map(([rate, variables]) => {
    const interval = setInterval(async () => {
      for (const [variableId, variable] of Object.entries(variables)) {
        if (hasFr202Source(variable)) {
          if (isVariableNumberWithFr202AnalogInputSource(variable)) {
            const value = await adcReadMilliamps(variable.source.pin);
            updateRuntimeValue(plc, variableId, value);
          }
          if (isVariableBooleanWithFr202DiscreteInputSource(variable)) {
            const value = await dioGetOnePinStatus(
              variable.source.pin,
              variable.source.group
            );
            updateRuntimeValue(plc, variableId, value);
          }
        }
      }
    }, Number(rate));
    return [String(rate), interval];
  }));
  plc.runtime.fr202Intervals = intervals
  return () => {
    stopFr202Intervals(plc);
  };
};

export function stopFr202Intervals <
  M extends PlcMqtts,
  S extends PlcSources,
  V extends PlcVariables<M, S>
>(plc: Plc<M, S, V>) {
  const { fr202Intervals } = plc.runtime;
  Object.values(fr202Intervals).forEach((interval) => clearInterval(interval));
  return plc;
};
  
