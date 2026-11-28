import { getApiErrorCode, isUnknownWriteOutcome } from "../api/client";

// A confirmed atomic rollback may be corrected. Missing/ambiguous responses must be reconciled.
export function holdTestOrder(error: unknown): boolean {
  return (
    getApiErrorCode(error) !== "AUDIT_PERSISTENCE_FAILED" &&
    isUnknownWriteOutcome(error)
  );
}
