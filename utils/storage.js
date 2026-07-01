const STORAGE_KEY = "plant-archive-v2-store";
const PENDING_EDIT_KEY = "plant-archive-v2-pending-edit";
const LOCAL_STATE_KEYS = [STORAGE_KEY, PENDING_EDIT_KEY];
const BACKUP_VERSION = 1;
const EDITABLE_FIELDS = ["score", "stage", "focus", "note", "cover", "moments"];
const TEXT_FIELDS = ["stage", "focus", "note", "cover"];

function mergePlantOverrides(plants, overrides = {}) {
  return plants.map((plant) => ({
    ...plant,
    ...(overrides[plant.id] || {})
  }));
}

function mergePlantOverride(overrides = {}, plantId, patch) {
  return {
    ...overrides,
    [plantId]: {
      ...(overrides[plantId] || {}),
      ...patch
    }
  };
}

function createArchiveBackup(overrides = {}) {
  return JSON.stringify({
    app: "plant-archive-v2",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    overrides
  });
}

function sanitizePlantPatch(patch = {}) {
  const safePatch = {};

  if (patch.score !== undefined) {
    const score = Number(patch.score);

    if (Number.isFinite(score)) {
      safePatch.score = Math.min(10, Math.max(0, Number(score.toFixed(1))));
    }
  }

  TEXT_FIELDS.forEach((field) => {
    if (typeof patch[field] === "string") {
      safePatch[field] = patch[field];
    }
  });

  if (Array.isArray(patch.moments)) {
    safePatch.moments = patch.moments
      .filter((moment) => moment && typeof moment === "object")
      .map((moment) => ({
        id: typeof moment.id === "string" ? moment.id : "",
        photo: typeof moment.photo === "string" ? moment.photo : "",
        createdAt: typeof moment.createdAt === "string" ? moment.createdAt : "",
        summary: typeof moment.summary === "string" ? moment.summary : "",
        advice: typeof moment.advice === "string" ? moment.advice : "",
        stage: typeof moment.stage === "string" ? moment.stage : ""
      }))
      .filter((moment) => moment.id && moment.createdAt);
  }

  return safePatch;
}

function parseArchiveBackup(rawText, plantIds) {
  const parsed = JSON.parse(rawText);
  const allowedPlantIds = new Set(plantIds);
  const safeOverrides = {};

  if (
    !parsed ||
    parsed.app !== "plant-archive-v2" ||
    parsed.version !== BACKUP_VERSION ||
    !parsed.overrides
  ) {
    throw new Error("INVALID_BACKUP");
  }

  Object.keys(parsed.overrides).forEach((plantId) => {
    if (!allowedPlantIds.has(plantId)) return;

    const patch = parsed.overrides[plantId] || {};
    const safePatch = sanitizePlantPatch(patch);

    if (Object.keys(safePatch).length) {
      safeOverrides[plantId] = safePatch;
    }
  });

  return safeOverrides;
}

function countArchiveOverrides(overrides = {}) {
  return Object.keys(overrides).length;
}

module.exports = {
  STORAGE_KEY,
  PENDING_EDIT_KEY,
  LOCAL_STATE_KEYS,
  BACKUP_VERSION,
  EDITABLE_FIELDS,
  mergePlantOverrides,
  mergePlantOverride,
  createArchiveBackup,
  sanitizePlantPatch,
  parseArchiveBackup,
  countArchiveOverrides
};
