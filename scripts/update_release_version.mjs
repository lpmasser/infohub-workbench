import fs from "node:fs";
import path from "node:path";

const file = path.resolve(import.meta.dirname, "../package.json");
const metadata = JSON.parse(fs.readFileSync(file, "utf8"));
const version = process.argv[2];
if (version === "--print-current") {
  process.stdout.write(`${metadata.version}\n`);
} else {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("Provide a major.minor.patch version.");
  metadata.version = version;
  fs.writeFileSync(file, `${JSON.stringify(metadata, null, 2)}\n`);
}
