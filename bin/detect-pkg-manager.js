const { hasFile } = require("./file-manager");

function getPackageManager() {
  const packageManagers = [
    { id: "yarn", file: hasFile("yarn.lock") },
    { id: "bun", file: hasFile("bun.lockb") },
    { id: "pnpm", file: hasFile("pnpm-lock.yaml") },
    { id: "npm", file: hasFile("package-lock.json") },
  ];

  let largest = packageManagers[0];

  for (let i = 0; i < packageManagers.length; i++) {
    if (
      packageManagers[i].file &&
      packageManagers[i].file.split("/").length > largest
    ) {
      largest = i;
    }
  }

  return packageManagers[largest] || "npm";
}

module.exports = { getPackageManager };
