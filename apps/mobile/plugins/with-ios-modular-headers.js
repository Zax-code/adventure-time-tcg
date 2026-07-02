const fs = require("node:fs/promises");
const path = require("node:path");

const { withDangerousMod } = require("@expo/config-plugins");

const MODULAR_HEADERS_LINE = "use_modular_headers!";

function addModularHeaders(podfile) {
  if (podfile.includes(MODULAR_HEADERS_LINE)) {
    return podfile;
  }

  return podfile.replace(
    /(platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[^']+'\n)/,
    `$1${MODULAR_HEADERS_LINE}\n`,
  );
}

module.exports = function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      const podfile = await fs.readFile(podfilePath, "utf8");
      await fs.writeFile(podfilePath, addModularHeaders(podfile));
      return config;
    },
  ]);
};
