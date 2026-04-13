import { describe, it, expect } from "vitest";
import wildcards from "../bin/wildcards.js";

const {
  extractWildcardDescriptors,
  parseWildcardSpec,
  parseArrayInput,
  resolveWildcardTemplate,
  renderResolvedValue,
} = wildcards;

describe("parseWildcardSpec", () => {
  it("parses scalar wildcard", () => {
    expect(parseWildcardSpec("pkg")).toMatchObject({
      name: "pkg",
      isArray: false,
      arrayMode: null,
      enumValues: null,
    });
  });

  it("parses enum scalar wildcard", () => {
    expect(parseWildcardSpec("pkg:enum(button|modal|card)")).toMatchObject({
      name: "pkg",
      isArray: false,
      arrayMode: null,
      enumValues: ["button", "modal", "card"],
    });
  });

  it("parses array wildcard with mode and enum", () => {
    expect(
      parseWildcardSpec("pkg:array:or:enum(button|modal|card)"),
    ).toMatchObject({
      name: "pkg",
      isArray: true,
      arrayMode: "or",
      enumValues: ["button", "modal", "card"],
    });
  });

  it("defaults array mode to csv", () => {
    expect(parseWildcardSpec("pkg:array")).toMatchObject({
      isArray: true,
      arrayMode: "csv",
    });
  });

  it("rejects array mode without :array", () => {
    expect(() => parseWildcardSpec("pkg:or")).toThrow(/missing ":array"/i);
  });
});

describe("parseArrayInput", () => {
  it("supports comma input", () => {
    expect(parseArrayInput("button,modal")).toEqual(["button", "modal"]);
  });

  it("supports pipe input", () => {
    expect(parseArrayInput("button|modal")).toEqual(["button", "modal"]);
  });

  it("supports bracketed comma input", () => {
    expect(parseArrayInput("[button,modal] ")).toEqual(["button", "modal"]);
  });

  it("supports parenthesized pipe input", () => {
    expect(parseArrayInput(" (button|modal)")).toEqual(["button", "modal"]);
  });

  it("supports single input", () => {
    expect(parseArrayInput("button")).toEqual(["button"]);
  });
});

describe("renderResolvedValue", () => {
  it("renders OR arrays", () => {
    const descriptor = parseWildcardSpec("pkg:array:or");
    expect(renderResolvedValue(descriptor, "button,modal")).toBe("(button|modal)");
  });

  it("renders brace arrays", () => {
    const descriptor = parseWildcardSpec("pkg:array:brace");
    expect(renderResolvedValue(descriptor, "button|modal")).toBe("{button,modal}");
  });

  it("renders space arrays", () => {
    const descriptor = parseWildcardSpec("pkg:array:space");
    expect(renderResolvedValue(descriptor, "button,modal")).toBe("button modal");
  });

  it("enforces enum for arrays", () => {
    const descriptor = parseWildcardSpec("pkg:array:or:enum(button|modal)");
    expect(() => renderResolvedValue(descriptor, "button,toast")).toThrow(
      /allowed: button, modal/i,
    );
  });

  it("enforces enum for scalar", () => {
    const descriptor = parseWildcardSpec("pkg:enum(button|modal)");
    expect(() => renderResolvedValue(descriptor, "toast")).toThrow(
      /allowed: button, modal/i,
    );
  });
});

describe("resolveWildcardTemplate", () => {
  it("resolves mixed scalar and array wildcards", () => {
    const command =
      "yarn typecheck packages/${pkg:array:or:enum(button|modal|card)} --kind=${kind:enum(ui|core)}";

    const resolved = resolveWildcardTemplate(command, {
      pkg: "button,modal",
      kind: "ui",
    });

    expect(resolved).toBe("yarn typecheck packages/(button|modal) --kind=ui");
  });

  it("extracts descriptors from command", () => {
    const descriptors = extractWildcardDescriptors(
      "x ${pkg:array:csv} y ${kind:enum(ui|core)}",
    );

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0].name).toBe("pkg");
    expect(descriptors[1].name).toBe("kind");
  });
});
