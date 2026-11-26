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

describe("wildcard argument parsing", () => {
  const { parseWildcardArgs, getUniqueWildcardNames } = wildcards;

  it("accepts no arguments", () => expect(parseWildcardArgs()).toEqual({}));
  it("preserves empty values and equals signs in values", () => {
    expect(parseWildcardArgs(["empty=", "query=a=b", "pkg_name=core"])).toEqual({ empty: "", query: "a=b", pkg_name: "core" });
  });
  it("uses the last value for a repeated assignment", () => {
    expect(parseWildcardArgs(["pkg=old", "pkg=new"])).toEqual({ pkg: "new" });
  });
  it.each(["pkg", "=value", ""])("rejects malformed assignment %j", (value) => {
    expect(() => parseWildcardArgs([value])).toThrow(/Expected format: name=value/);
  });
  it.each(["bad-name=x", "bad name=x", "pkg.name=x"])("rejects invalid names in %j", (value) => {
    expect(() => parseWildcardArgs([value])).toThrow(/Invalid wildcard name/);
  });
  it("deduplicates names in first occurrence order", () => {
    expect(getUniqueWildcardNames(extractWildcardDescriptors("${b} ${a} ${b:array}"))).toEqual(["b", "a"]);
  });
});

describe("wildcard validation and edge cases", () => {
  it.each(["", "bad-name", "bad name", "pkg.name"])("rejects invalid template name %j", (spec) => {
    expect(() => parseWildcardSpec(spec)).toThrow(/Invalid wildcard template/);
  });
  it.each(["pkg:unknown", "pkg:enum(a|b", "pkg:array:unknown"])("rejects unsupported modifiers in %j", (spec) => {
    expect(() => parseWildcardSpec(spec)).toThrow(/Invalid wildcard modifier/);
  });
  it.each(["pkg:enum()", "pkg:enum( )", "pkg:enum(||)"])("rejects empty enums in %j", (spec) => {
    expect(() => parseWildcardSpec(spec)).toThrow(/enum must include at least one value/);
  });
  it("trims comma-separated enum choices", () => {
    expect(parseWildcardSpec("pkg:enum( button, modal, )").enumValues).toEqual(["button", "modal"]);
  });
  it.each(["", "  ", "[]", "()", ",,"])("parses empty array input %j", (value) => {
    expect(parseArrayInput(value)).toEqual([]);
    expect(() => renderResolvedValue(parseWildcardSpec("pkg:array"), value)).toThrow(/expects one or more values/);
  });
  it("trims values and discards empty array elements", () => {
    expect(parseArrayInput(" button, , modal, ")).toEqual(["button", "modal"]);
  });
  it("renders csv arrays by default", () => {
    expect(renderResolvedValue(parseWildcardSpec("pkg:array"), "button|modal")).toBe("button,modal");
  });
  it("accepts allowed scalar and array enum values", () => {
    expect(renderResolvedValue(parseWildcardSpec("pkg:enum(button|modal)"), " button ")).toBe("button");
    expect(renderResolvedValue(parseWildcardSpec("pkg:array:enum(button|modal)"), "button,modal")).toBe("button,modal");
  });
  it("reports all invalid enum entries", () => {
    expect(() => renderResolvedValue(parseWildcardSpec("pkg:array:enum(button)"), "toast,card")).toThrow(/Invalid values.*toast, card/);
  });
  it("leaves commands without wildcards unchanged", () => {
    expect(resolveWildcardTemplate("echo hello", {})).toBe("echo hello");
    expect(extractWildcardDescriptors("echo hello")).toEqual([]);
  });
  it("resolves repeated placeholders and resets matching between calls", () => {
    expect(resolveWildcardTemplate("${pkg}/${pkg}", { pkg: "button" })).toBe("button/button");
    expect(resolveWildcardTemplate("${pkg}", { pkg: "modal" })).toBe("modal");
    expect(extractWildcardDescriptors("${pkg}")).toHaveLength(1);
    expect(extractWildcardDescriptors("${kind}")[0].name).toBe("kind");
  });
});

it("parses names that overlap Object prototype properties as literal keys", () => {
  const values = wildcards.parseWildcardArgs(["__proto__=literal", "toString=text"]);
  expect(Object.hasOwn(values, "__proto__")).toBe(true);
  expect(values.__proto__).toBe("literal");
  expect(values.toString).toBe("text");
});

it("validates enum and empty arrays before expanding exec arguments", () => {
  expect(() => wildcards.resolveWildcardArguments(["${pkg:array:space:enum(button|modal)}"], { pkg: "toast" })).toThrow(/Invalid value/);
  expect(() => wildcards.resolveWildcardArguments(["${pkg:array:space}"], { pkg: "" })).toThrow(/expects one or more values/);
});
