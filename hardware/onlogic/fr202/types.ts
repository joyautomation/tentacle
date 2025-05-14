import { 
  isVariableBoolean, 
  isVariableNumber, 
  type PlcVariableBoolean, 
  type PlcVariableNumber, 
  type PlcVariableBooleanRuntime, 
  type PlcVariableNumberRuntime 
} from "../../../types/variables.ts";

type Fr202DiscreteBase = {
  group: number,
  pin: number
}

type WithFr202DiscreteInputSource = {
  source: {
    type: 'fr202di'
    rate: number  
  } & Fr202DiscreteBase
}

type WithFr202DiscreteOutputSource = {
  source: {
    type: 'fr202do'
    rate: number  
  } & Fr202DiscreteBase
}

type WithFr202AnalogInputSource = {
  source: {
    type: 'fr202ai'
    rate: number 
    pin: number
  }
}

export type PlcVariableBooleanWithFr202DiscreteInputSource =
  PlcVariableBoolean
  & WithFr202DiscreteInputSource

export type PlcVariableBooleanWithFr202DiscreteOutputSource =
  PlcVariableBoolean
  & WithFr202DiscreteOutputSource

export type PlcVariableNumberWithFr202AnalogInputSource =
  PlcVariableNumber
  & WithFr202AnalogInputSource

export type PlcVariableBooleanRuntimeWithFr202DiscreteInputSource =
  PlcVariableBooleanRuntime
  & WithFr202DiscreteInputSource

export type PlcVariableBooleanRuntimeWithFr202DiscreteOutputSource =
  PlcVariableBooleanRuntime
  & WithFr202DiscreteOutputSource

export type PlcVariableNumberRuntimeWithFr202AnalogInputSource =
  PlcVariableNumberRuntime
  & WithFr202AnalogInputSource

export const isVariableBooleanWithFr202DiscreteInputSource = (variable: unknown): variable is PlcVariableBooleanWithFr202DiscreteInputSource =>
  isVariableBoolean(variable) && (variable as PlcVariableBooleanWithFr202DiscreteInputSource).source?.type === 'fr202di';

export const isVariableBooleanWithFr202DiscreteOutputSource = (variable: unknown): variable is PlcVariableBooleanWithFr202DiscreteOutputSource =>
  isVariableBoolean(variable) && (variable as PlcVariableBooleanWithFr202DiscreteOutputSource).source?.type === 'fr202do';

export const isVariableNumberWithFr202AnalogInputSource = (variable: unknown): variable is PlcVariableNumberWithFr202AnalogInputSource =>
  isVariableNumber(variable) && (variable as PlcVariableNumberWithFr202AnalogInputSource).source?.type === 'fr202ai';

export const hasFr202Source = (variable: unknown): variable is WithFr202DiscreteInputSource | WithFr202DiscreteOutputSource | WithFr202AnalogInputSource =>
  isVariableBooleanWithFr202DiscreteInputSource(variable) ||
  isVariableBooleanWithFr202DiscreteOutputSource(variable) ||
  isVariableNumberWithFr202AnalogInputSource(variable);
  
