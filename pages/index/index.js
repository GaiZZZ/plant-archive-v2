const { defaultPlants, familyMeta } = require("../../utils/plants");
const { buildArchiveView, getDashboardMetrics } = require("../../utils/archive");
const { ensurePrivacyAuthorized } = require("../../utils/privacy");
const {
  LOCAL_STATE_KEYS,
  PENDING_EDIT_KEY,
  STORAGE_KEY,
  mergePlantOverride,
  mergePlantOverrides
} = require("../../utils/storage");

Page({
  data: {
    family: "ALL",
    focusMode: "ALL",
    sort: "desc",
    activeSection: "today",
    plants: [],
    dashboardCards: [],
    filterItems: [],
    groupedPlants: [],
    pokedexEntries: [],
    todayPlants: [],
    capturePlants: [],
    collectionStats: {
      total: 0,
      collected: 0,
      checkins: 0,
      progressPercent: "0%",
      progressText: "0%",
      albumText: "0 张"
    },
    diagnosisPhoto: "",
    diagnosisResult: null,
    filterSummary: "",
    pokedexSummary: "",
    heroTitle: "今天的小森林状态不错",
    heroSubtitle: "",
    heroBriefing: "",
    editingId: "",
    editModel: null,
    modalOpen: false,
    sortOptions: [
      { value: "desc", label: "高到低" },
      { value: "asc", label: "低到高" }
    ],
    sortIndex: 0,
    sortLabel: "高到低"
  },

  onLoad() {
    this.reloadPlants();
  },

  onShow() {
    this.reloadPlants();
    this.openPendingEdit();
  },

  reloadPlants() {
    this.setData({
      plants: this.loadPlants()
    });
    this.renderPage();
  },

  onShareAppMessage() {
    return {
      title: "植物档案 V2",
      path: "/pages/index/index",
      imageUrl: "/plant-hero-morning.jpg"
    };
  },

  loadPlants() {
    const overrides = wx.getStorageSync(STORAGE_KEY) || {};
    return mergePlantOverrides(defaultPlants, overrides);
  },

  persistPlantOverride(plantId, patch) {
    const overrides = wx.getStorageSync(STORAGE_KEY) || {};
    const nextOverrides = mergePlantOverride(overrides, plantId, patch);

    try {
      wx.setStorageSync(STORAGE_KEY, nextOverrides);
      return true;
    } catch (error) {
      wx.showToast({
        title: "保存失败",
        icon: "none"
      });
      return false;
    }
  },

  updatePlant(plantId, patch) {
    if (!this.persistPlantOverride(plantId, patch)) return;

    const plants = this.data.plants.map((plant) =>
      plant.id === plantId ? { ...plant, ...patch } : plant
    );

    this.setData({ plants });
    this.renderPage();
  },

  renderPage() {
    const viewModel = buildArchiveView(this.data.plants, familyMeta, {
      family: this.data.family,
      focusMode: this.data.focusMode,
      sort: this.data.sort
    });
    const metrics = getDashboardMetrics(this.data.plants);
    const todayPlants = (metrics.watchPlants.length ? metrics.watchPlants : metrics.duePlants)
      .slice(0, 4)
      .map((plant) => ({
        ...plant,
        momentCount: plant.moments ? plant.moments.length : 0,
        scoreText: Number(plant.score).toFixed(1)
      }));
    const capturePlants = this.data.plants.map((plant) => ({
      ...plant,
      collected: Boolean(plant.cover || (plant.moments && plant.moments.length)),
      momentCount: plant.moments ? plant.moments.length : 0,
      scoreText: Number(plant.score).toFixed(1)
    }));
    const pokedexEntries = this.getPokedexEntries(this.data.plants);
    const visiblePokedexEntries =
      this.data.family === "ALL"
        ? pokedexEntries
        : pokedexEntries.filter((entry) => entry.code === this.data.family);
    const collectionStats = this.getCollectionStats(pokedexEntries);
    const pokedexSummary =
      this.data.family === "ALL"
        ? `当前显示全部图鉴条目，共 ${visiblePokedexEntries.length} 类植物。`
        : `当前显示 ${familyMeta[this.data.family].name} 图鉴条目。`;

    this.setData({
      ...viewModel,
      todayPlants,
      capturePlants,
      pokedexEntries: visiblePokedexEntries,
      pokedexSummary,
      collectionStats
    });
  },

  getPokedexEntries(plants) {
    return Object.keys(familyMeta).map((code) => {
      const family = familyMeta[code];
      const members = plants.filter((plant) => plant.code === code);
      const collectedMembers = members.filter((plant) => {
        const moments = plant.moments || [];
        return Boolean(plant.cover || moments.length);
      });
      const coverMember = collectedMembers.find((plant) => plant.cover);
      const samplePlant = collectedMembers[0] || members[0];
      const momentCount = members.reduce((sum, plant) => {
        const moments = plant.moments || [];
        return sum + moments.length;
      }, 0);
      const scoreTotal = members.reduce((sum, plant) => sum + Number(plant.score), 0);
      const avgScore = members.length ? scoreTotal / members.length : 0;
      const previewNames = members.slice(0, 2).map((plant) => plant.name).join("、");
      const extraCount = members.length > 2 ? ` 等 ${members.length} 盆` : "";
      const collected = collectedMembers.length > 0;

      return {
        code,
        name: family.name,
        color: family.color,
        plantId: samplePlant ? samplePlant.id : "",
        collected,
        locked: !collected,
        cover: coverMember && coverMember.cover ? coverMember.cover : "/plant-hero-cutout.png",
        memberCount: members.length,
        momentCount,
        memberText: `${members.length} 个养护档案`,
        speciesText: `${previewNames}${extraCount}`,
        statusText: collected ? `已点亮 · ${momentCount} 次打卡` : "未解锁 · 拍第一张点亮",
        albumText: `${momentCount} 张成长照片`,
        collectedText: `${collectedMembers.length}/${members.length} 盆已开始养护`,
        scoreText: avgScore ? avgScore.toFixed(1) : "--"
      };
    });
  },

  getCollectionStats(entries) {
    const total = entries.length;
    let collected = 0;
    let checkins = 0;

    entries.forEach((entry) => {
      if (entry.collected) collected += 1;
      checkins += entry.momentCount;
    });

    const progress = total ? Math.round((collected / total) * 100) : 0;

    return {
      total,
      collected,
      checkins,
      progressPercent: `${progress}%`,
      progressText: `${progress}%`,
      albumText: `${checkins} 张`
    };
  },

  createMoment(plant, photo) {
    const now = new Date();
    const score = Number(plant.score).toFixed(1);

    return {
      id: `${plant.id}-${now.getTime()}`,
      photo,
      createdAt: now.toISOString(),
      stage: plant.stage,
      summary: `本次打卡健康分 ${score}，先按当前养护方案继续观察。`,
      advice: `AI 策略占位：结合 ${plant.light} 和 ${plant.watering}，后续会根据照片变化给出更具体建议。`
    };
  },

  formatDiagnosisResult(plant, moment, isFirstCapture) {
    const score = Number(plant.score);
    const healthLevel = score >= 9.5 ? "状态优秀" : score >= 8.8 ? "基本健康" : "需要观察";

    return {
      title: `${plant.name} 已进入养护档案`,
      status: isFirstCapture ? "首次收集" : "新增打卡",
      summary: moment.summary,
      identify: {
        label: "识别结果",
        title: plant.name,
        copy: `${plant.family} · ${plant.code}。这张照片已归入你的植物图鉴。`
      },
      diagnose: {
        label: "健康诊断",
        title: healthLevel,
        copy: `当前档案健康分 ${Number(plant.score).toFixed(1)}。${plant.focus}`
      },
      carePlan: {
        label: "养护建议",
        title: "接下来这样照看",
        items: [
          moment.advice,
          `浇水：${plant.watering}`,
          `光照：${plant.light}`
        ]
      }
    };
  },

  switchSection(event) {
    this.setData({
      activeSection: event.currentTarget.dataset.section
    });
  },

  onDashboardTap(event) {
    const focusMode = event.currentTarget.dataset.focusMode;
    if (!focusMode) return;

    this.setData({
      focusMode: this.data.focusMode === focusMode ? "ALL" : focusMode
    });
    this.renderPage();
  },

  onFamilyTap(event) {
    this.setData({
      family: event.currentTarget.dataset.family
    });
    this.renderPage();
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.value);
    this.setData({
      sortIndex,
      sort: this.data.sortOptions[sortIndex].value,
      sortLabel: this.data.sortOptions[sortIndex].label
    });
    this.renderPage();
  },

  openEditModal(event) {
    const plantId = event.currentTarget.dataset.plantId;
    this.openEditById(plantId);
  },

  openEditById(plantId) {
    const plant = this.data.plants.find((item) => item.id === plantId);
    if (!plant) return;

    this.setData({
      editingId: plantId,
      editModel: {
        ...plant,
        score: Number(plant.score).toFixed(1)
      },
      modalOpen: true
    });
  },

  openPendingEdit() {
    const pendingEditId = wx.getStorageSync(PENDING_EDIT_KEY);
    if (!pendingEditId) return;

    wx.removeStorageSync(PENDING_EDIT_KEY);
    this.openEditById(pendingEditId);
  },

  openDetailPage(event) {
    const plantId = event.currentTarget.dataset.plantId;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(plantId)}`
    });
  },

  closeEditModal() {
    this.setData({
      editingId: "",
      editModel: null,
      modalOpen: false
    });
  },

  onEditInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`editModel.${field}`]: event.detail.value
    });
  },

  submitEdit() {
    const { editingId, editModel } = this.data;
    if (!editingId || !editModel) return;

    const nextScore = Math.min(10, Math.max(0, Number(editModel.score)));
    if (Number.isNaN(nextScore)) {
      wx.showToast({
        title: "请输入有效评分",
        icon: "none"
      });
      return;
    }

    this.updatePlant(editingId, {
      score: Number(nextScore.toFixed(1)),
      stage: editModel.stage.trim(),
      focus: editModel.focus.trim(),
      note: editModel.note.trim()
    });
    this.closeEditModal();
    wx.showToast({
      title: "已保存",
      icon: "success"
    });
  },

  chooseCover(event) {
    const plantId = event.currentTarget.dataset.plantId;
    ensurePrivacyAuthorized(() => {
      this.openMediaChooser(plantId);
    });
  },

  openMediaChooser(plantId) {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.saveFile({
          tempFilePath,
          success: (saveResult) => {
            this.updatePlant(plantId, { cover: saveResult.savedFilePath });
            wx.showToast({
              title: "封面已更新",
              icon: "success"
            });
          },
          fail: () => {
            this.updatePlant(plantId, { cover: tempFilePath });
            wx.showToast({
              title: "封面已更新",
              icon: "success"
            });
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: "未选择照片",
          icon: "none"
        });
      }
    });
  },

  startAiDiagnosis() {
    this.setData({
      activeSection: "capture"
    });
  },

  capturePlant(event) {
    const plantId = event.currentTarget.dataset.plantId;
    const plant = this.data.plants.find((item) => item.id === plantId);
    if (!plant) return;

    ensurePrivacyAuthorized(() => {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          wx.saveFile({
            tempFilePath,
            success: (saveResult) => {
              this.savePlantMoment(plant, saveResult.savedFilePath);
            },
            fail: () => {
              this.savePlantMoment(plant, tempFilePath);
            }
          });
        },
        fail: () => {
          wx.showToast({
            title: "未选择照片",
            icon: "none"
          });
        }
      });
    });
  },

  savePlantMoment(plant, photo) {
    const moments = plant.moments || [];
    const isFirstCapture = !plant.cover && !moments.length;
    const moment = this.createMoment(plant, photo);

    this.updatePlant(plant.id, {
      cover: plant.cover || photo,
      moments: [moment, ...moments]
    });
    this.setData({
      diagnosisPhoto: photo,
      diagnosisResult: this.formatDiagnosisResult(plant, moment, isFirstCapture),
      activeSection: "capture"
    });
    wx.showToast({
      title: isFirstCapture ? "已点亮图鉴" : "已记录打卡",
      icon: "success"
    });
  },

  resetLocalArchive() {
    wx.showModal({
      title: "清空本地修改",
      content: "将清除本机保存的评分、备注、封面和生命周期打卡记录，恢复为初始植物档案。",
      confirmText: "清空",
      confirmColor: "#8d3e59",
      success: (res) => {
        if (!res.confirm) return;

        LOCAL_STATE_KEYS.forEach((key) => {
          wx.removeStorageSync(key);
        });
        this.setData({
          plants: this.loadPlants(),
          family: "ALL",
          focusMode: "ALL",
          sort: "desc",
          sortIndex: 0,
          sortLabel: "高到低"
        });
        this.renderPage();
        wx.showToast({
          title: "已清空",
          icon: "success"
        });
      }
    });
  },

  openPrivacyPage() {
    wx.navigateTo({
      url: "/pages/privacy/privacy"
    });
  },

  noop() {
  }
});
