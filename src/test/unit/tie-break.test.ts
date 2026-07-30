import { describe, expect, it } from "vitest";
import { tieBreakValue } from "@/server/ranking/tie-break";

describe("tieBreakValue", () => {
  it("POINTS_AVERAGE utilise la moyenne", () => {
    expect(tieBreakValue("POINTS_AVERAGE", { legDifference: 2, average: 55.5 })).toBe(55.5);
  });

  it("LEG_DIFFERENCE utilise la différence de legs", () => {
    expect(tieBreakValue("LEG_DIFFERENCE", { legDifference: 3, average: 40 })).toBe(3);
  });

  it("HEAD_TO_HEAD retombe sur la différence de legs en V1", () => {
    expect(tieBreakValue("HEAD_TO_HEAD", { legDifference: -1, average: 40 })).toBe(-1);
  });

  it("RANDOM_DRAW retombe sur la différence de legs en V1", () => {
    expect(tieBreakValue("RANDOM_DRAW", { legDifference: 0, average: 40 })).toBe(0);
  });
});
