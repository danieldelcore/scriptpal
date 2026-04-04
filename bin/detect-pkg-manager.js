const { hasFile } = require("./file-manager");

function getPackageManager() {
  const packageManagers = [
    { id: "yarn", file: hasFile("yarn.lock") },
    { id: "bun", file: hasFile("bun.lockb") },
    { id: "pnpm", file: hasFile("pnpm-lock.yaml") },
    { id: "npm", file: hasFile("package-lock.json") },
  ];

  const foundPackageManagers = packageManagers.filter(
    (manager) => typeof manager.file === "string",
  );

  if (!foundPackageManagers.length) {
    return "npm";
  }

  const closestPackageManager = foundPackageManagers.sort(
    (a, b) => b.file.split("/").length - a.file.split("/").length,
  )[0];

  return closestPackageManager.id;
}

module.exports = { getPackageManager };
