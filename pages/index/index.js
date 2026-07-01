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
    todayPlants: [],
    diagnosisPhoto: "",
    diagnosisResult: null,
    filterSummary: "",
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
        scoreText: Number(plant.score).toFixed(1)
      }));

    this.setData({
      ...viewModel,
      todayPlants
    });
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
    ensurePrivacyAuthorized(() => {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          this.setData({
            diagnosisPhoto: tempFilePath,
            diagnosisResult: {
              title: "AI 诊断入口已就绪",
              status: "等待接入真实 AI",
              summary: "现在先保存照片和诊断流程位置；接入云函数后，这里会返回健康判断、可能原因和养护策略。",
              actions: [
                "检查叶片是否有卷边、黄斑或软塌",
                "记录最近一次浇水时间和盆土湿度",
                "补充光照环境，方便 AI 给出更准确建议"
              ]
            },
            activeSection: "diagnosis"
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

  resetLocalArchive() {
    wx.showModal({
      title: "清空本地修改",
      content: "将清除本机保存的评分、备注和封面，恢复为初始植物档案。",
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
