import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { initializeLease, tryAcquireLeadership } from "./lease.ts";

// describe("Lease", () => {
//   it("should create a lease", async () => {
//     const lease = initializeLease({
//       lease: "test-lease",
//       namespace: "xbox1",
//       identity: "test-identity",
//     });
//     expect(lease).toBeDefined();
//     const result = await tryAcquireLeadership(lease, () => {
//       console.log("Leadership lost");
//     });
//     expect(result).toEqual({});
//   });
// });
