export const mark = (key: string, name: string, eventType: "start" | "end") =>
  performance.mark(`${key}-${name}-${eventType}`);

export const measure = (key: string, name: string) =>
  performance.measure(
    `${key}-${name}`,
    `${key}-${name}-start`,
    `${key}-${name}-end`,
  );

export const clearMeasure = (key: string, name: string) =>
  performance.clearMeasures(`${key}-${name}`);

export const markExecuteStart = (key: string) => mark(key, "execute", "start");
export const markExecuteEnd = (key: string) => mark(key, "execute", "end");
export const measureExecute = (key: string) => measure(key, "execute");
export const clearExecuteMeasure = (key: string) =>
  clearMeasure(key, "execute");

export const markWaitStart = (key: string) => mark(key, "wait", "start");
export const markWaitEnd = (key: string) => mark(key, "wait", "end");
export const measureWait = (key: string) => measure(key, "wait");
export const clearWaitMeasure = (key: string) => clearMeasure(key, "wait");
