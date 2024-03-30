import fs from "fs/promises";
import * as log from "../log.mjs";

const getPackageManager = async () => {
  const dir = await fs.readdir(process.cwd());
  const result = {
    isPnpm: dir.includes("pnpm-lock.yaml"),
    isNpm: dir.includes("package-lock.json"),
    isYarn: dir.includes("yarn.lock"),
  };

  const managersCount = [result.isNpm, result.isPnpm, result.isYarn].reduce(
    (sum, b) => (b ? sum + 1 : sum),
    0,
  );
  if (managersCount === 0) {
    log.error("Couldn't detect any package managers");
    process.exit(1);
  }
  if (managersCount > 1) {
    log.error("Detected too many package managers");
    log.error(JSON.stringify(result));
    process.exit(1);
  }

  const packageManagerCommand = result.isNpm
    ? "npm"
    : result.isPnpm
      ? "pnpm"
      : result.isYarn
        ? "yarn"
        : undefined;
  if (!packageManagerCommand) throw new Error("internal error");

  return packageManagerCommand;
};

export default getPackageManager;
