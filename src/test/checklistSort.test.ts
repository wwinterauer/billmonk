import { describe, it, expect } from "vitest";
import { byName, sortByName } from "@/lib/checklistSort";

describe("checklistSort", () => {
  it("sortiert Checklisten-Positionen alphabetisch", () => {
    const items = [
      { name: "Zahlungseingang prüfen" },
      { name: "Belege hochladen" },
      { name: "Umsatzsteuer-Voranmeldung" },
    ];

    expect(sortByName(items).map((i) => i.name)).toEqual([
      "Belege hochladen",
      "Umsatzsteuer-Voranmeldung",
      "Zahlungseingang prüfen",
    ]);
  });

  it("ignoriert Groß-/Kleinschreibung und Umlaute nach deutscher Kollation", () => {
    const items = [{ name: "Ziel" }, { name: "Ähnlich" }, { name: "apfel" }, { name: "Banane" }];

    expect(sortByName(items).map((i) => i.name)).toEqual([
      "Ähnlich",
      "apfel",
      "Banane",
      "Ziel",
    ]);
  });

  it("hält Positionen ohne Namen am Ende", () => {
    const items = [{ name: "" }, { name: "Kasse" }, { name: null }];

    expect(sortByName(items).map((i) => i.name)).toEqual(["Kasse", "", null]);
  });

  it("verändert die ursprüngliche Liste nicht", () => {
    const items = [{ name: "b" }, { name: "a" }];

    sortByName(items);

    expect(items.map((i) => i.name)).toEqual(["b", "a"]);
  });

  it("vergleicht auch Zahlen sinnvoll (Position 2 vor Position 10)", () => {
    expect(byName({ name: "Position 2" }, { name: "Position 10" })).toBeLessThan(0);
  });
});
