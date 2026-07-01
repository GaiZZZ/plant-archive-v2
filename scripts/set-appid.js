const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APPID_PATTERN = /^wx[a-z0-9]{16}$/i;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, data) {
  fs.writeFileSync(
    path.join(ROOT, relativePath),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

function main() {
  const appid = process.argv[2];

  if (!appid || !APPID_PATTERN.test(appid)) {
    throw new Error("Usage: npm run set:appid -- wx1234567890abcdef");
  }

  const projectConfig = readJson("project.config.json");
  projectConfig.appid = appid;
  writeJson("project.config.json", projectConfig);

  console.log(`AppID updated in project.config.json: ${appid}`);
}

try {
  main();
} catch (error) {
  console.error(`Set AppID failed: ${error.message}`);
  process.exit(1);
}
