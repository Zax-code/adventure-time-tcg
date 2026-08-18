import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const APPIUM_BIN = path.resolve(
  import.meta.dirname,
  "../../../../node_modules/.bin/appium",
);
const APPIUM_HOME =
  process.env.APPIUM_HOME ??
  path.join(os.homedir(), ".cache", "adventure-time-tcg", "appium");
const DRIVERS = [
  {
    name: "xcuitest",
    spec: "appium-xcuitest-driver@11.7.3",
    version: "11.7.3",
  },
  {
    name: "uiautomator2",
    spec: "appium-uiautomator2-driver@6.7.11",
    version: "6.7.11",
  },
];

function run(args) {
  const result = spawnSync(APPIUM_BIN, args, {
    encoding: "utf8",
    env: { ...process.env, APPIUM_HOME },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Appium ${args.join(" ")} failed.`);
  }
  return result.stdout;
}

function installedDrivers() {
  const output = run(["driver", "list", "--installed", "--json"]);
  const jsonStart = output.indexOf("{");
  if (jsonStart < 0) throw new Error("Appium did not return its installed drivers.");
  return JSON.parse(output.slice(jsonStart));
}

for (const driver of DRIVERS) {
  const installed = installedDrivers()[driver.name];
  if (installed?.version === driver.version) {
    process.stdout.write(`${driver.name} ${driver.version} is already installed.\n`);
    continue;
  }

  if (installed) {
    run(["driver", "uninstall", driver.name]);
  }
  run(["driver", "install", "--source=npm", driver.spec]);
  process.stdout.write(`Installed ${driver.name} ${driver.version}.\n`);
}
