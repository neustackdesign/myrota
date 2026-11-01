// Runs the compiled pure-domain tests. The output folder is pinned to CommonJS
// so it works whether or not package.json declares "type": "module".
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = ".domain-test";
writeFileSync(join(out, "package.json"), JSON.stringify({ type: "commonjs" }));
const dir = join(out, "tests", "domain");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => join(dir, f));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
