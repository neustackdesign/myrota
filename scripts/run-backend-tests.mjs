// Compiles and runs the backend unit tests (pure server logic: INCI normalisation,
// catalogue search, extract validators). Pinned to CommonJS so JSON + relative
// requires resolve the same way the domain-test harness does.
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const out = ".backend-test";
const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.backend-test.json"], { stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

writeFileSync(join(out, "package.json"), JSON.stringify({ type: "commonjs" }));
// tsc does not copy JSON data files to outDir; the compiled catalogue-store needs it alongside.
mkdirSync(join(out, "lib", "server"), { recursive: true });
copyFileSync(join("lib", "server", "catalogue-data.json"), join(out, "lib", "server", "catalogue-data.json"));

const dir = join(out, "tests", "backend");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => join(dir, f));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
