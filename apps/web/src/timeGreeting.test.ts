import { describe, expect, it } from "vitest";
import { getIstGreeting } from "./timeGreeting";

describe("IST greeting", () => {
  it.each([
    ["2026-10-12T00:30:00.000Z", "Good Morning"],
    ["2026-10-12T07:30:00.000Z", "Good Afternoon"],
    ["2026-10-12T12:30:00.000Z", "Good Evening"],
    ["2026-10-12T17:30:00.000Z", "Good Evening"],
  ])("uses Asia/Kolkata for %s", (value, expected) => {
    expect(getIstGreeting(new Date(value))).toBe(expected);
  });
});