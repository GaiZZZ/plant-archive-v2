const fs = require("fs");
const path = require("path");
const { defaultPlants, familyMeta } = require("../utils/plants");
const {
  buildArchiveView,
  getDashboardMetrics,
  getFilteredPlants
} = require("../utils/archive");
const {
  countArchiveOverrides,
  createArchiveBackup,
  LOCAL_STATE_KEYS,
  PENDING_EDIT_KEY,
  parseArchiveBackup,
  sanitizePlantPatch,
  STORAGE_KEY,
  mergePlantOverride,
  mergePlantOverrides
} = require("../utils/storage");
const { ensurePrivacyAuthorized } = require("../utils/privacy");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_LIMIT_BYTES = 2 * 1024 * 1024;
const isReleaseCheck = process.argv.includes("--release");
const shouldPrintPackageReport = process.argv.includes("--report");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(relativePath) {
  assert(fs.existsSync(path.join(ROOT, relativePath)), `Missing file: ${relativePath}`);
}

function walkFiles(directory, ignoredFiles, ignoredFolders, rows) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(ROOT, absolutePath);

    if (entry.isDirectory()) {
      if (
        ignoredFolders.has(relativePath) ||
        ignoredFolders.has(entry.name) ||
        entry.name === "node_modules"
      ) {
        continue;
      }

      walkFiles(absolutePath, ignoredFiles, ignoredFolders, rows);
      continue;
    }

    if (ignoredFiles.has(relativePath)) continue;

    rows.push({
      path: relativePath,
      size: fs.statSync(absolutePath).size
    });
  }
}

function getPackageRows(projectConfig) {
  const ignoredFiles = new Set(
    projectConfig.packOptions.ignore
      .filter((item) => item.type === "file")
      .map((item) => item.value)
  );
  const ignoredFolders = new Set(
    projectConfig.packOptions.ignore
      .filter((item) => item.type === "folder")
      .map((item) => item.value)
  );
  const rows = [];

  walkFiles(ROOT, ignoredFiles, ignoredFolders, rows);
  return rows;
}

function checkConfig() {
  const appConfig = readJson("app.json");
  const projectConfig = readJson("project.config.json");

  assert(
    appConfig.pages.includes("pages/index/index"),
    "app.json must include pages/index/index"
  );
  assert(
    appConfig.pages.includes("pages/detail/detail"),
    "app.json must include pages/detail/detail"
  );
  assert(
    appConfig.pages.includes("pages/privacy/privacy"),
    "app.json must include pages/privacy/privacy"
  );
  assert(appConfig.permission?.["scope.camera"]?.desc, "Camera permission desc is required");
  assert(
    appConfig.permission["scope.camera"].desc.includes("诊断素材"),
    "Camera permission desc should mention diagnosis material usage"
  );
  assert(projectConfig.compileType === "miniprogram", "compileType must be miniprogram");
  assert(projectConfig.setting.urlCheck === true, "urlCheck should stay enabled for release");
  assert(projectConfig.condition?.miniprogram?.list?.length, "Preview condition is missing");

  if (isReleaseCheck) {
    assert(projectConfig.appid !== "touristappid", "Release check requires a real AppID");
    assert(/^wx[a-z0-9]{16}$/i.test(projectConfig.appid), "AppID format should look like wx + 16 chars");
  }
}

function checkFiles() {
  [
    "app.js",
    "app.json",
    "app.wxss",
    "sitemap.json",
    "project.config.json",
    "project.private.config.json",
    "README.md",
    "scripts/set-appid.js",
    "pages/index/index.js",
    "pages/index/index.wxml",
    "pages/index/index.wxss",
    "pages/index/index.json",
    "pages/detail/detail.js",
    "pages/detail/detail.wxml",
    "pages/detail/detail.wxss",
    "pages/detail/detail.json",
    "pages/privacy/privacy.js",
    "pages/privacy/privacy.wxml",
    "pages/privacy/privacy.wxss",
    "pages/privacy/privacy.json",
    "utils/plants.js",
    "utils/archive.js",
    "utils/storage.js",
    "utils/privacy.js",
    "plant-hero-cutout.png",
    "plant-hero-morning.jpg",
    "WECHAT-MINIPROGRAM.md",
    "MINIPROGRAM-SUBMISSION-CHECKLIST.md",
    "WECHAT-SUBMISSION-COPY.md",
    "miniprogram-assets/app-icon-144.jpg",
    "miniprogram-assets/app-icon-512.jpg",
    "miniprogram-assets/share-cover.png"
  ].forEach(assertFile);
}

function checkPlantData() {
  const ids = new Set();
  const familyCodes = new Set(Object.keys(familyMeta));

  defaultPlants.forEach((plant) => {
    assert(!ids.has(plant.id), `Duplicate plant id: ${plant.id}`);
    ids.add(plant.id);
    assert(familyCodes.has(plant.code), `Unknown family code for ${plant.id}`);
    assert(Number.isFinite(plant.score), `Invalid score for ${plant.id}`);
    assert(plant.score >= 0 && plant.score <= 10, `Score out of range for ${plant.id}`);
    ["name", "family", "stage", "focus", "note"].forEach((field) => {
      assert(String(plant[field] || "").trim(), `Missing ${field} for ${plant.id}`);
    });
  });
}

function checkArchiveLogic() {
  const metrics = getDashboardMetrics(defaultPlants);
  const duePlants = getFilteredPlants(defaultPlants, {
    family: "ALL",
    focusMode: "due",
    sort: "asc"
  });
  const watchPlants = getFilteredPlants(defaultPlants, {
    family: "ALL",
    focusMode: "watch",
    sort: "asc"
  });
  const view = buildArchiveView(defaultPlants, familyMeta, {
    family: "ALL",
    focusMode: "ALL",
    sort: "desc"
  });

  assert(metrics.duePlants.length === 4, "Expected 4 due plants from seed data");
  assert(metrics.watchPlants.length === 3, "Expected 3 watch plants from seed data");
  assert(duePlants.every((plant) => plant.score <= 9), "Due filter includes high score plant");
  assert(watchPlants.every((plant) => plant.score <= 8.8), "Watch filter includes high score plant");
  assert(view.groupedPlants.length === Object.keys(familyMeta).length, "Missing grouped families");
  assert(view.dashboardCards.length === 3, "Dashboard card count changed unexpectedly");
}

function checkStorageLogic() {
  const overrides = mergePlantOverride({}, "CY-001", {
    score: 7.5,
    note: "自检覆盖备注"
  });
  const mergedPlants = mergePlantOverrides(defaultPlants, {
    ...overrides
  });
  const target = mergedPlants.find((plant) => plant.id === "CY-001");

  assert(STORAGE_KEY === "plant-archive-v2-store", "Storage key changed unexpectedly");
  assert(PENDING_EDIT_KEY === "plant-archive-v2-pending-edit", "Pending edit key changed unexpectedly");
  assert(LOCAL_STATE_KEYS.includes(STORAGE_KEY), "Local state keys should include plant archive store");
  assert(LOCAL_STATE_KEYS.includes(PENDING_EDIT_KEY), "Local state keys should include pending edit key");
  assert(target.score === 7.5, "Storage override did not update score");
  assert(target.note === "自检覆盖备注", "Storage override did not update note");
  assert(target.name === "白粉彩叶芋", "Storage override should preserve seed data");

  const backupText = createArchiveBackup(overrides);
  const restored = parseArchiveBackup(
    backupText,
    defaultPlants.map((plant) => plant.id)
  );
  assert(restored["CY-001"].score === 7.5, "Backup restore did not preserve score");
  assert(!restored["NOT-A-PLANT"], "Backup restore should ignore unknown plant ids");
  assert(countArchiveOverrides(restored) === 1, "Backup restore count should include only safe plant overrides");

  let invalidBackupRejected = false;
  try {
    parseArchiveBackup(
      JSON.stringify({ app: "plant-archive-v2", version: 999, overrides }),
      defaultPlants.map((plant) => plant.id)
    );
  } catch (error) {
    invalidBackupRejected = true;
  }
  assert(invalidBackupRejected, "Backup restore should reject unsupported versions");

  const sanitized = sanitizePlantPatch({
    score: 99,
    stage: "安全阶段",
    focus: 123,
    unknown: "should drop",
    moments: [
      {
        id: "CY-001-1",
        photo: "wxfile://capture.jpg",
        createdAt: "2026-07-01T00:00:00.000Z",
        summary: "第一次打卡",
        advice: "保持观察",
        stage: "稳定生长期"
      },
      {
        id: "",
        createdAt: "2026-07-01T00:00:00.000Z"
      }
    ]
  });
  assert(sanitized.score === 10, "Backup score should be clamped to 10");
  assert(sanitized.stage === "安全阶段", "Backup text field should be preserved");
  assert(sanitized.focus === undefined, "Backup non-string text field should be ignored");
  assert(sanitized.unknown === undefined, "Backup unknown fields should be ignored");
  assert(sanitized.moments.length === 1, "Backup moments should keep only valid lifecycle records");
  assert(sanitized.moments[0].summary === "第一次打卡", "Backup moments should preserve lifecycle summary");
}

function checkPrivacyLogic() {
  const originalWx = global.wx;
  let authorizedCount = 0;

  try {
    global.wx = undefined;
    ensurePrivacyAuthorized(() => {
      authorizedCount += 1;
    });
    assert(authorizedCount === 1, "Privacy helper should continue on older base libraries");

    let requestedAuthorization = false;
    global.wx = {
      requirePrivacyAuthorize(options) {
        requestedAuthorization = true;
        options.success();
      },
      showToast() {}
    };
    ensurePrivacyAuthorized(() => {
      authorizedCount += 1;
    });
    assert(requestedAuthorization, "Privacy helper should call requirePrivacyAuthorize when available");
    assert(authorizedCount === 2, "Privacy helper should continue after successful authorization");

    let toastTitle = "";
    global.wx = {
      requirePrivacyAuthorize(options) {
        options.fail();
      },
      showToast(options) {
        toastTitle = options.title;
      }
    };
    ensurePrivacyAuthorized(() => {
      authorizedCount += 1;
    });
    assert(authorizedCount === 2, "Privacy helper should not continue after failed authorization");
    assert(toastTitle === "请先同意隐私授权", "Privacy helper should explain failed authorization");
  } finally {
    global.wx = originalWx;
  }
}

function checkWxssCompatibility() {
  const riskyPatterns = [
    { pattern: /\bdisplay:\s*grid\b/, label: "display: grid" },
    { pattern: /\bgrid-template\b/, label: "grid-template" },
    { pattern: /@media\b/, label: "@media" },
    { pattern: /\bplace-items\b/, label: "place-items" },
    { pattern: /\bgap\s*:/, label: "gap" },
    { pattern: /\binset\s*:/, label: "inset" }
  ];

  ["app.wxss", "pages/index/index.wxss", "pages/detail/detail.wxss", "pages/privacy/privacy.wxss"].forEach((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    riskyPatterns.forEach((item) => {
      assert(
        !item.pattern.test(content),
        `${relativePath} contains risky WXSS property: ${item.label}`
      );
    });
  });
}

function checkRuntimeJsCompatibility() {
  [
    "app.js",
    "pages/index/index.js",
    "pages/detail/detail.js",
    "pages/privacy/privacy.js",
    "utils/plants.js",
    "utils/archive.js",
    "utils/storage.js",
    "utils/privacy.js"
  ].forEach((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert(!/\?\./.test(content), `${relativePath} contains optional chaining`);
  });
}

function checkDocsConsistency() {
  const onlineGuide = fs.readFileSync(path.join(ROOT, "WECHAT-MINIPROGRAM.md"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const indexPage = fs.readFileSync(path.join(ROOT, "pages/index/index.wxml"), "utf8");
  const detailPage = fs.readFileSync(path.join(ROOT, "pages/detail/detail.wxml"), "utf8");
  const privacyPage = fs.readFileSync(path.join(ROOT, "pages/privacy/privacy.wxml"), "utf8");
  const submissionChecklist = fs.readFileSync(
    path.join(ROOT, "MINIPROGRAM-SUBMISSION-CHECKLIST.md"),
    "utf8"
  );
  const submissionCopy = fs.readFileSync(path.join(ROOT, "WECHAT-SUBMISSION-COPY.md"), "utf8");

  assert(
    !onlineGuide.includes("增加清空本地档案入口"),
    "Online guide still lists implemented clear-local-data feature as future work"
  );
  assert(
    submissionChecklist.includes("剪贴板"),
    "Submission checklist should mention clipboard usage for backup and restore"
  );
  assert(
    submissionChecklist.includes("备份文本仅由用户主动复制和恢复"),
    "Submission checklist should clarify backup text is user-controlled"
  );
  assert(
    onlineGuide.includes("npm run report:package"),
    "Online guide should mention package report command"
  );
  assert(
    submissionChecklist.includes("npm run report:package"),
    "Submission checklist should include package report command"
  );
  assert(
    readme.includes("WECHAT-SUBMISSION-COPY.md") &&
      onlineGuide.includes("WECHAT-SUBMISSION-COPY.md") &&
      submissionChecklist.includes("WECHAT-SUBMISSION-COPY.md"),
    "Docs should link the submission copy file"
  );
  assert(
    submissionCopy.includes("无需测试账号") &&
      submissionCopy.includes("npm run check:release") &&
      submissionCopy.includes("剪贴板"),
    "Submission copy should include review notes, release check, and clipboard privacy copy"
  );
  assert(
    privacyPage.includes("剪贴板") &&
      privacyPage.includes("复制本地备份文本") &&
      privacyPage.includes("从剪贴板读取备份文本"),
    "Privacy page should disclose clipboard usage consistently"
  );
  assert(
    privacyPage.includes("诊断素材") &&
      submissionChecklist.includes("诊断素材") &&
      submissionCopy.includes("诊断素材"),
    "Privacy copy should disclose photo usage for diagnosis material"
  );
  assert(
    readme.includes("今日养护台、我的图鉴、拍照打卡") &&
      onlineGuide.includes("植物图鉴收集") &&
      submissionChecklist.includes("今日 / 图鉴 / 拍照") &&
      submissionCopy.includes("生命周期打卡记录"),
    "Docs should describe the collection and photo check-in product structure"
  );
  assert(
    readme.includes("拍照识别 + 健康诊断 + 图鉴收集 + 成长相册") &&
      onlineGuide.includes("拍照识别、健康诊断和 AI 养护策略") &&
      submissionChecklist.includes("拍照识别、健康诊断和 AI 养护策略") &&
      submissionCopy.includes("拍照识别、健康诊断和 AI 养护策略"),
    "Docs should keep the identify, diagnose, collect, and growth album positioning"
  );
  assert(
    indexPage.includes("Plant Pokédex") &&
      indexPage.includes("data-section=\"collection\"") &&
      indexPage.includes("data-section=\"capture\"") &&
      indexPage.includes("capturePlant") &&
      indexPage.includes("collectionStats") &&
      indexPage.includes("pokedexEntries") &&
      indexPage.includes("pokedex-card") &&
      indexPage.includes("图鉴进度") &&
      indexPage.includes("成长相册") &&
      indexPage.includes("未点亮"),
    "Home page should expose collection and photo check-in sections"
  );
  assert(
    indexPage.includes("diagnosisResult.identify") &&
      indexPage.includes("diagnosisResult.diagnose") &&
      indexPage.includes("diagnosisResult.carePlan"),
    "Home diagnosis result should show identify, diagnose, and care plan sections"
  );
  assert(
    detailPage.includes("植物百科方案") &&
      detailPage.includes("生命周期档案") &&
      detailPage.includes("拍照打卡"),
    "Detail page should include encyclopedia care plan and lifecycle timeline"
  );
}

function checkPackageSize() {
  const projectConfig = readJson("project.config.json");
  const rows = getPackageRows(projectConfig);
  const total = rows.reduce((sum, row) => sum + row.size, 0);
  const includedPaths = new Set(rows.map((row) => row.path));
  const allowedRuntimePatterns = [
    /^app\.(js|json|wxss)$/,
    /^sitemap\.json$/,
    /^project\.config\.json$/,
    /^plant-hero-cutout\.png$/,
    /^plant-hero-morning\.jpg$/,
    /^pages\/(index|detail|privacy)\/[^/]+\.(js|json|wxml|wxss)$/,
    /^utils\/(plants|archive|storage|privacy)\.js$/
  ];

  assert(total < PACKAGE_LIMIT_BYTES, `Package is too large: ${total} bytes`);
  assert(!includedPaths.has("WECHAT-MINIPROGRAM.md"), "Runtime package includes docs");
  assert(!includedPaths.has("MINIPROGRAM-SUBMISSION-CHECKLIST.md"), "Runtime package includes checklist");
  assert(!includedPaths.has("WECHAT-SUBMISSION-COPY.md"), "Runtime package includes submission copy");
  assert(![...includedPaths].some((item) => item.startsWith("miniprogram-assets/")), "Runtime package includes submission assets");
  rows.forEach((row) => {
    assert(
      allowedRuntimePatterns.some((pattern) => pattern.test(row.path)),
      `Unexpected runtime package file: ${row.path}`
    );
  });

  return { rows, total };
}

function printPackageReport(rows, total) {
  console.log("");
  console.log("Estimated upload package files:");
  rows
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach((row) => {
      console.log(`- ${row.path} (${row.size} bytes)`);
    });
  console.log(`Total: ${total} bytes`);
}

function main() {
  checkConfig();
  checkFiles();
  checkPlantData();
  checkArchiveLogic();
  checkStorageLogic();
  checkPrivacyLogic();
  checkWxssCompatibility();
  checkRuntimeJsCompatibility();
  checkDocsConsistency();
  const packageReport = checkPackageSize();

  console.log(
    `${isReleaseCheck ? "Release" : "Mini program"} checks passed. Estimated package size: ${packageReport.total} bytes.`
  );

  if (shouldPrintPackageReport) {
    printPackageReport(packageReport.rows, packageReport.total);
  }
}

try {
  main();
} catch (error) {
  console.error(`Check failed: ${error.message}`);
  process.exit(1);
}
