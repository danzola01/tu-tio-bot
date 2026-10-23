import { readFileSync } from "node:fs";

const required = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();
const minimum = required.split(".").map(Number);
const actual = process.versions.node.split(".").map(Number);
const tooOld = actual[1] < minimum[1] || (actual[1] === minimum[1] && actual[2] < minimum[2]);

if (actual[0] !== minimum[0] || tooOld) {
  console.error(`Tu Tio Bot requires Node ${minimum[0]}.x >= ${required}; found ${process.versions.node}.`);
  process.exit(1);
}
