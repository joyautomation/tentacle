const worker = new Worker(
  new URL("./ui.ts", import.meta.url).href,
  {
    type: "module",
  },
);

export { worker };
