#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const counterPath = join(root, "build-version.json");
const versionPath = join(root, ".app-version");

function formatAppBuildVersion(date, buildNumber) {
  const year = date.getFullYear();
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}.${day}.${month}.${buildNumber}`;
}

function readCounter() {
  if (!existsSync(counterPath)) {
    return { buildNumber: 0 };
  }
  return JSON.parse(readFileSync(counterPath, "utf8"));
}

let buildNumber;
if (process.env.BUILD_NUMBER) {
  buildNumber = Number.parseInt(process.env.BUILD_NUMBER, 10);
  if (!Number.isFinite(buildNumber) || buildNumber < 1) {
    console.error("bump-build-version: BUILD_NUMBER must be a positive integer");
    process.exit(1);
  }
} else {
  const counter = readCounter();
  buildNumber = (counter.buildNumber ?? 0) + 1;
  writeFileSync(
    counterPath,
    `${JSON.stringify({ buildNumber }, null, 2)}\n`,
    "utf8"
  );
}

const version = formatAppBuildVersion(new Date(), buildNumber);
writeFileSync(versionPath, `${version}\n`, "utf8");
console.log(`App version: ${version}`);
