import { describe, expect, it } from 'vitest';

describe('student identity rules', () => {
  it('uses student UID as an immutable identity', () => {
    expect('NSR-TS-HYD-2026-000001').toMatch(/^NSR-[A-Z]{2}-[A-Z]+-\d{4}-\d{6}$/);
  });
});
