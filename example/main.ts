import { createTentacle } from "../index.ts";

const main = await createTentacle(
  "tentacle-example",
  "This is an example using the Tentacle PLC lib",
  {}
);

await main();
