import { initializeLease, tryAcquireLeadership } from "./lease.ts";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

let interval: ReturnType<typeof setInterval> | null = null;

const cleanup = async () => {
  console.log("\nCleaning up...");
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  Deno.exit(0);
};

try {
  console.log("Creating lease...");
  const lease = initializeLease({
    lease: `test-lease`,
    namespace: "xbox1",
    identity: `test-identity-${nanoid(7)}`,
  });

  await tryAcquireLeadership(lease, () => {
    console.log("Leadership lost");
  });

  Deno.addSignalListener("SIGINT", () => cleanup());
} catch (error) {
  console.error("Failed to create lease:", error);
}
