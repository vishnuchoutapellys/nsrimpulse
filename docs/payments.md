# Payments

Payment business logic must depend on a provider-independent adapter. The authoritative path is gateway webhook/signature verification, followed by an idempotent payment row, installment allocations, receipt, and notification. The frontend success screen is never authoritative. Offline payments use the same payment and receipt model with a recorded mode and reference.
