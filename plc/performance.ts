export const performanceStage = {
  execute: {
    start: 0,
    end: 0,
  },
  wait: {
    start: 0,
    end: 0,
  },
}

type PerformanceStageId = keyof typeof performanceStage;

const mark = (key: PerformanceStageId, property: "start" | "end") => { performanceStage[key][property] = performance.now(); }

export const markExecuteStart = () => { mark("execute", "start"); };
export const markExecuteEnd = () => { mark("execute", "end"); };
export const measureExecute = () => performanceStage["execute"].end - performanceStage["execute"].start

export const markWaitStart = () => { mark("wait", "start"); };
export const markWaitEnd = () => { mark("wait", "end"); };
export const measureWait = () => performanceStage["wait"].end - performanceStage["wait"].start;
