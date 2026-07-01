const DUE_SCORE = 9.0;
const WATCH_SCORE = 8.8;

function getFamilies(familyMeta) {
  return Object.entries(familyMeta).map(([code, meta]) => ({
    code,
    name: meta.name,
    color: meta.color
  }));
}

function getFilteredPlants(plants, options) {
  const { family = "ALL", focusMode = "ALL", sort = "desc" } = options;
  let filtered = [...plants];

  if (focusMode === "due") {
    filtered = filtered.filter((plant) => plant.score <= DUE_SCORE);
  } else if (focusMode === "watch") {
    filtered = filtered.filter((plant) => plant.score <= WATCH_SCORE);
  }

  if (family !== "ALL") {
    filtered = filtered.filter((plant) => plant.code === family);
  }

  return filtered.sort((a, b) =>
    sort === "desc" ? b.score - a.score : a.score - b.score
  );
}

function getDashboardMetrics(plants) {
  const watchPlants = [...plants]
    .filter((plant) => plant.score <= WATCH_SCORE)
    .sort((a, b) => a.score - b.score);
  const duePlants = [...plants]
    .filter((plant) => plant.score <= DUE_SCORE)
    .sort((a, b) => a.score - b.score);
  const avgScore =
    plants.reduce((sum, plant) => sum + Number(plant.score), 0) / plants.length;
  const highest = [...plants].sort((a, b) => b.score - a.score)[0];
  const lowest = [...plants].sort((a, b) => a.score - b.score)[0];

  return {
    duePlants,
    watchPlants,
    avgScore,
    highest,
    lowest
  };
}

function buildDashboardCards(metrics, focusMode) {
  return [
    {
      label: "今日待查",
      value: metrics.duePlants.length,
      focusMode: "due",
      active: focusMode === "due"
    },
    {
      label: "重点观察",
      value: metrics.watchPlants.length,
      focusMode: "watch",
      active: focusMode === "watch"
    },
    {
      label: "平均健康分",
      value: metrics.avgScore.toFixed(1),
      focusMode: "",
      active: false
    }
  ];
}

function buildFilterItems(families, activeFamily) {
  return [
    { code: "ALL", label: "ALL / 全部家族", active: activeFamily === "ALL" },
    ...families.map((family) => ({
      code: family.code,
      label: `${family.code} / ${family.name}`,
      active: activeFamily === family.code
    }))
  ];
}

function buildGroupedPlants(families, visiblePlants) {
  return families
    .map((family) => ({
      ...family,
      items: visiblePlants
        .filter((plant) => plant.code === family.code)
        .map((plant) => ({
          ...plant,
          scoreText: Number(plant.score).toFixed(1),
          scorePercent: `${Math.max(0, Math.min(100, Number(plant.score) * 10))}%`
        }))
    }))
    .filter((group) => group.items.length > 0);
}

function buildFilterSummary(options) {
  const { focusMode, family, familyName, visibleCount, sort } = options;
  const scopeText =
    focusMode === "due"
      ? "当前只显示今日待查植物"
      : focusMode === "watch"
        ? "当前只显示重点观察植物"
        : family === "ALL"
          ? "当前显示全部植物"
          : `当前显示 ${familyName} 家族植物`;

  return `${scopeText}，共 ${visibleCount} 盆，按评分${sort === "desc" ? "从高到低" : "从低到高"}排序。`;
}

function buildHeroCopy(metrics) {
  const watchNames = metrics.watchPlants
    .slice(0, 3)
    .map((plant) => plant.name)
    .join("、");

  return {
    heroTitle:
      metrics.avgScore >= 9.2 ? "今天的小森林状态不错" : "今天的小森林需要一点照看",
    heroSubtitle: `有 ${metrics.duePlants.length} 株植物建议顺手看看，其中 ${metrics.watchPlants.length} 株需要持续观察。`,
    heroBriefing: `今日整体健康分 ${metrics.avgScore.toFixed(1)}。状态最佳：${metrics.highest.name}。今日优先查看：${watchNames || metrics.lowest.name}。`
  };
}

function buildArchiveView(plants, familyMeta, state) {
  const families = getFamilies(familyMeta);
  const metrics = getDashboardMetrics(plants);
  const visiblePlants = getFilteredPlants(plants, state);
  const activeFamilyName = state.family === "ALL" ? "" : familyMeta[state.family].name;

  return {
    dashboardCards: buildDashboardCards(metrics, state.focusMode),
    filterItems: buildFilterItems(families, state.family),
    groupedPlants: buildGroupedPlants(families, visiblePlants),
    filterSummary: buildFilterSummary({
      focusMode: state.focusMode,
      family: state.family,
      familyName: activeFamilyName,
      visibleCount: visiblePlants.length,
      sort: state.sort
    }),
    ...buildHeroCopy(metrics)
  };
}

module.exports = {
  DUE_SCORE,
  WATCH_SCORE,
  getFamilies,
  getFilteredPlants,
  getDashboardMetrics,
  buildArchiveView
};
