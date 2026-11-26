"use strict";

const chalk = require("chalk");

const WILDCARD_REGEX = /\$\{([^}]+)\}/g;
const VALID_WILDCARD_NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const ARRAY_RENDERERS = {
  or: (values) => `(${values.join("|")})`,
  brace: (values) => `{${values.join(",")}}`,
  space: (values) => values.join(" "),
  csv: (values) => values.join(","),
};

function parseEnumOptions(rawOptions, wildcardName) {
  const source = rawOptions.trim();

  if (!source) {
    throw new Error(
      chalk.red(`Wildcard "${wildcardName}" enum must include at least one value.`),
    );
  }

  const delimiter = source.includes("|") ? "|" : ",";
  const options = source
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);

  if (options.length === 0) {
    throw new Error(
      chalk.red(`Wildcard "${wildcardName}" enum must include at least one value.`),
    );
  }

  return options;
}

function parseWildcardSpec(spec) {
  const parts = spec.split(":");
  const name = parts.shift();

  if (!name || !VALID_WILDCARD_NAME_REGEX.test(name)) {
    throw new Error(
      chalk.red(
        `Invalid wildcard template "${spec}". Wildcard names must match ${"[a-zA-Z0-9_]"}.`,
      ),
    );
  }

  const descriptor = {
    raw: spec,
    name,
    isArray: false,
    arrayMode: null,
    enumValues: null,
  };

  for (const modifier of parts) {
    if (modifier === "array") {
      descriptor.isArray = true;
      continue;
    }

    if (modifier in ARRAY_RENDERERS) {
      descriptor.arrayMode = modifier;
      continue;
    }

    if (modifier.startsWith("enum(") && modifier.endsWith(")")) {
      const enumBody = modifier.slice(5, -1);
      descriptor.enumValues = parseEnumOptions(enumBody, name);
      continue;
    }

    throw new Error(
      chalk.red(
        `Invalid wildcard modifier "${modifier}" in "${spec}". Supported modifiers: array, ${Object.keys(
          ARRAY_RENDERERS,
        ).join(", ")}, enum(...).`,
      ),
    );
  }

  if (descriptor.arrayMode && !descriptor.isArray) {
    throw new Error(
      chalk.red(
        `Wildcard "${name}" uses array mode "${descriptor.arrayMode}" but is missing ":array".`,
      ),
    );
  }

  if (descriptor.isArray && !descriptor.arrayMode) {
    descriptor.arrayMode = "csv";
  }

  return descriptor;
}

function extractWildcardDescriptors(template) {
  const descriptors = [];
  WILDCARD_REGEX.lastIndex = 0;
  let match;

  while ((match = WILDCARD_REGEX.exec(template)) !== null) {
    descriptors.push(parseWildcardSpec(match[1]));
  }

  return descriptors;
}

function parseWildcardArgs(wildcardPairs = []) {
  return wildcardPairs.reduce((values, pair) => {
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex <= 0) {
      throw new Error(
        chalk.red(
          `Invalid wildcard "${pair}". Expected format: name=value (e.g. package=core).`,
        ),
      );
    }

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);

    if (!VALID_WILDCARD_NAME_REGEX.test(name)) {
      throw new Error(
        chalk.red(
          `Invalid wildcard name "${name}". Wildcard names must match ${"[a-zA-Z0-9_]"}.`,
        ),
      );
    }

    Object.defineProperty(values, name, {
      value, enumerable: true, configurable: true, writable: true,
    });
    return values;
  }, {});
}

function parseArrayInput(value) {
  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  const isBracketedCsv = normalized.startsWith("[") && normalized.endsWith("]");
  const isGroupedOr = normalized.startsWith("(") && normalized.endsWith(")");

  const source = isBracketedCsv || isGroupedOr ? normalized.slice(1, -1) : normalized;
  const delimiter = source.includes("|") ? "|" : source.includes(",") ? "," : null;

  if (!delimiter) {
    return [source.trim()].filter(Boolean);
  }

  return source
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateEnum(descriptor, values) {
  if (!descriptor.enumValues) {
    return;
  }

  const invalidValues = values.filter(
    (value) => !descriptor.enumValues.includes(value),
  );

  if (invalidValues.length > 0) {
    throw new Error(
      chalk.red(
        `Invalid value${invalidValues.length > 1 ? "s" : ""} for wildcard "${descriptor.name}": ${invalidValues.join(
          ", ",
        )}. Allowed: ${descriptor.enumValues.join(", ")}.`,
      ),
    );
  }
}

function renderResolvedValue(descriptor, inputValue, preserveWhitespace = false) {
  if (!descriptor.isArray) {
    const scalarValue = preserveWhitespace ? inputValue : inputValue.trim();
    validateEnum(descriptor, [scalarValue]);
    return scalarValue;
  }

  const items = parseArrayInput(inputValue);

  if (items.length === 0) {
    throw new Error(
      chalk.red(`Wildcard "${descriptor.name}" expects one or more values.`),
    );
  }

  validateEnum(descriptor, items);

  return ARRAY_RENDERERS[descriptor.arrayMode](items);
}

function getUniqueWildcardNames(descriptors) {
  return [...new Set(descriptors.map((descriptor) => descriptor.name))];
}

function resolveWildcardTemplate(command, values) {
  WILDCARD_REGEX.lastIndex = 0;
  return command.replace(WILDCARD_REGEX, (_, spec) => {
    const descriptor = parseWildcardSpec(spec);
    return renderResolvedValue(descriptor, values[descriptor.name]);
  });
}

function resolveWildcardArguments(args, values) {
  return args.flatMap((arg) => {
    const descriptors = extractWildcardDescriptors(arg);
    const spaceArray = descriptors.find(
      (descriptor) => descriptor.isArray && descriptor.arrayMode === "space",
    );

    if (spaceArray) {
      if (arg !== `\${${spaceArray.raw}}`) {
        throw new Error(
          `Wildcard "${spaceArray.name}" with :array:space must occupy a whole argument in --exec mode.`,
        );
      }
      // Validate emptiness and enum constraints before returning individual items.
      renderResolvedValue(spaceArray, values[spaceArray.name]);
      return parseArrayInput(values[spaceArray.name]);
    }

    return [arg.replace(/\$\{([^}]+)\}/g, (_, spec) => {
      const descriptor = parseWildcardSpec(spec);
      return renderResolvedValue(descriptor, values[descriptor.name], true);
    })];
  });
}

module.exports = {
  ARRAY_RENDERERS,
  extractWildcardDescriptors,
  getUniqueWildcardNames,
  parseWildcardArgs,
  parseWildcardSpec,
  parseArrayInput,
  renderResolvedValue,
  resolveWildcardTemplate,
  resolveWildcardArguments,
};
