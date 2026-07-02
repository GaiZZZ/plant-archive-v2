function getHealthLevel(score) {
  const scoreNumber = Number(score);
  if (scoreNumber >= 9.5) return "状态优秀";
  if (scoreNumber >= 8.8) return "基本健康";
  return "需要观察";
}

function getConfidenceScore(score) {
  return Math.min(98, Math.max(82, Math.round(Number(score) * 10 - 1)));
}

function buildCandidateMatches(plants, plant, confidenceScore) {
  const sameFamily = plants.filter((item) => item.code === plant.code && item.id !== plant.id);
  const otherPlants = plants.filter((item) => item.code !== plant.code);
  const candidates = [plant].concat(sameFamily, otherPlants).slice(0, 3);

  return candidates.map((candidate, index) => {
    const score = Math.max(62, confidenceScore - index * 9);

    return {
      id: candidate.id,
      name: candidate.name,
      family: candidate.family,
      confidenceText: `${score}%`
    };
  });
}

function buildHealthIssues(plant, healthLevel) {
  if (healthLevel === "状态优秀") {
    return [
      {
        title: "未发现明显异常",
        severity: "低",
        summary: "叶片和生长节奏看起来稳定，继续保持当前环境。",
        action: `维持${plant.light}，不要突然换位置。`
      }
    ];
  }

  if (healthLevel === "基本健康") {
    return [
      {
        title: "轻微环境波动",
        severity: "中",
        summary: plant.focus,
        action: `先按${plant.watering}执行，复查新叶状态。`
      }
    ];
  }

  return [
    {
      title: "需要连续观察",
      severity: "高",
      summary: plant.focus,
      action: "先减少环境变化，检查盆土湿度、通风和叶背状态。"
    }
  ];
}

function buildAiMoment(plant, photo, mode, plants, createdAt) {
  const now = createdAt ? new Date(createdAt) : new Date();
  const score = Number(plant.score).toFixed(1);
  const healthLevel = getHealthLevel(plant.score);
  const confidenceScore = getConfidenceScore(plant.score);

  return {
    id: `${plant.id}-${now.getTime()}`,
    photo,
    createdAt: now.toISOString(),
    mode,
    modeLabel: mode === "identify" ? "识别记录" : "健康诊断",
    identifiedName: plant.name,
    confidenceText: `${confidenceScore}%`,
    candidateMatches: buildCandidateMatches(plants, plant, confidenceScore),
    scoreText: score,
    healthLevel,
    healthIssues: buildHealthIssues(plant, healthLevel),
    stage: plant.stage,
    summary: `本次打卡健康分 ${score}，先按当前养护方案继续观察。`,
    advice: `AI 策略占位：结合 ${plant.light} 和 ${plant.watering}，后续会根据照片变化给出更具体建议。`,
    careItems: [
      `浇水：${plant.watering}`,
      `光照：${plant.light}`,
      `观察重点：${plant.focus}`
    ]
  };
}

function buildArchivedMoment(sourceMoment, targetPlant) {
  const healthLevel = getHealthLevel(targetPlant.score);

  return {
    ...sourceMoment,
    id: `${targetPlant.id}-${new Date(sourceMoment.createdAt).getTime() || Date.now()}`,
    stage: targetPlant.stage,
    scoreText: Number(targetPlant.score).toFixed(1),
    healthLevel,
    healthIssues: buildHealthIssues(targetPlant, healthLevel),
    summary: `本次打卡健康分 ${Number(targetPlant.score).toFixed(1)}，先按当前养护方案继续观察。`,
    advice: `AI 策略占位：结合 ${targetPlant.light} 和 ${targetPlant.watering}，后续会根据照片变化给出更具体建议。`,
    careItems: [
      `浇水：${targetPlant.watering}`,
      `光照：${targetPlant.light}`,
      `观察重点：${targetPlant.focus}`
    ]
  };
}

function formatDiagnosisResult(plant, moment, isFirstCapture, mode, isSaved) {
  const healthLevel = getHealthLevel(plant.score);
  const modeText = mode === "identify" ? "识别完成" : "诊断完成";
  const saveText = isFirstCapture ? "加入我的植物" : "保存到成长档案";
  const resultStats = [
    { label: "可信度", value: moment.confidenceText || "92%" },
    { label: "健康分", value: moment.scoreText || Number(plant.score).toFixed(1) },
    { label: "归档状态", value: isSaved ? "已保存" : "待确认" }
  ];

  return {
    title: mode === "identify" ? `识别为 ${plant.name}` : `${plant.name} 健康诊断`,
    status: isSaved ? "已保存" : modeText,
    saveText,
    saved: Boolean(isSaved),
    summary: moment.summary,
    resultStats,
    candidateMatches: moment.candidateMatches || [],
    healthIssues: moment.healthIssues || [],
    identify: {
      label: "识别结果",
      title: plant.name,
      copy: `${plant.family} · ${plant.code}。你可以先查看结果，再决定是否加入我的植物。`
    },
    diagnose: {
      label: "健康诊断",
      title: healthLevel,
      copy: `当前档案健康分 ${Number(plant.score).toFixed(1)}。${plant.focus}`
    },
    carePlan: {
      label: "养护建议",
      title: "接下来这样照看",
      items: [moment.advice].concat((moment.careItems || []).slice(0, 2))
    }
  };
}

module.exports = {
  buildAiMoment,
  buildArchivedMoment,
  buildCandidateMatches,
  buildHealthIssues,
  formatDiagnosisResult,
  getHealthLevel
};
