import { describe, expect, it, vi } from "vitest";
vi.mock("../i18n/i18n", () => ({ default: { t: (key: string) => key } }));
import { holdTestOrder } from "./testOrderOutcome";
function failure(status?: number, code?: string) {
  return {
    isAxiosError: true,
    config: { method: "post", url: "/test-orders" },
    ...(status ? { response: { status, data: { error: { code } } } } : {}),
  };
}
describe("test-order reconciliation", () => {
  it.each([undefined, 500, 502, 503, 504])(
    "holds unknown outcome %s",
    (status) => expect(holdTestOrder(failure(status))).toBe(true),
  );
  it("permits explicit atomic audit rollback", () =>
    expect(holdTestOrder(failure(503, "AUDIT_PERSISTENCE_FAILED"))).toBe(
      false,
    ));
  it.each([400, 401, 403, 404, 409])(
    "does not mark confirmed refusal %s as unknown",
    (status) => expect(holdTestOrder(failure(status))).toBe(false),
  );
  it("does not mark clean reads as uncertain creates", () =>
    expect(
      holdTestOrder({ isAxiosError: true, config: { method: "get" } }),
    ).toBe(false));
});
