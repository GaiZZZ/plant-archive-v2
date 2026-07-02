const { defaultPlants, familyMeta } = require("../../utils/plants");
const { buildAiMoment } = require("../../utils/ai");
const { ensurePrivacyAuthorized } = require("../../utils/privacy");
const {
  PENDING_EDIT_KEY,
  STORAGE_KEY,
  mergePlantOverride,
  mergePlantOverrides
} = require("../../utils/storage");

Page({
  data: {
    plantId: "",
    plant: null,
    moments: [],
    albumPhotos: [],
    archiveStats: {
      photoCount: 0,
      latestMode: "暂无记录",
      currentStage: ""
    },
    careStrategy: {
      level: "",
      title: "",
      nextCheck: "",
      reason: "",
      actions: []
    },
    familyColor: "#b4d4a8",
    scorePercent: "0%"
  },

  onLoad(options) {
    const plantId = decodeURIComponent(options.id || "");
    this.setData({ plantId });
    this.refreshPlant();
  },

  onShow() {
    if (this.data.plantId) {
      this.refreshPlant();
    }
  },

  refreshPlant() {
    const plantId = this.data.plantId;
    const plant = this.loadPlant(plantId);

    if (!plant) {
      wx.showToast({
        title: "未找到植物",
        icon: "none"
      });
      return;
    }

    wx.setNavigationBarTitle({
      title: plant.name
    });

    const rawMoments = plant.moments || [];
    const moments = rawMoments.map((moment, index) => ({
      ...moment,
      modeLabel: moment.modeLabel || (moment.mode === "identify" ? "识别记录" : "健康诊断"),
      identifiedName: moment.identifiedName || plant.name,
      confidenceText: moment.confidenceText || "92%",
      candidateMatches: Array.isArray(moment.candidateMatches) ? moment.candidateMatches : [],
      scoreText: moment.scoreText || Number(plant.score).toFixed(1),
      healthLevel: moment.healthLevel || "待观察",
      healthIssues: Array.isArray(moment.healthIssues) ? moment.healthIssues : [],
      careItems: Array.isArray(moment.careItems) ? moment.careItems : [],
      displayDate: this.formatMomentDate(moment.createdAt),
      indexText: `第 ${rawMoments.length - index} 次打卡`
    }));
    const albumPhotos = moments
      .filter((moment) => moment.photo)
      .slice(0, 6)
      .map((moment) => ({
        id: moment.id,
        photo: moment.photo,
        label: moment.displayDate
      }));

    this.setData({
      plant: {
        ...plant,
        scoreText: Number(plant.score).toFixed(1)
      },
      moments,
      albumPhotos,
      archiveStats: {
        photoCount: moments.filter((moment) => moment.photo).length,
        latestMode: moments.length ? moments[0].modeLabel : "暂无记录",
        currentStage: plant.stage
      },
      careStrategy: this.buildCareStrategy(plant, moments[0]),
      familyColor: familyMeta[plant.code] ? familyMeta[plant.code].color : "#b4d4a8",
      scorePercent: `${Math.max(0, Math.min(100, Number(plant.score) * 10))}%`
    });
  },

  buildCareStrategy(plant, latestMoment) {
    const score = Number(plant.score);
    const needsAttention = score < 8.9;
    const nextCheckDays = needsAttention ? 2 : score < 9.5 ? 4 : 7;
    const nextCheck = this.formatFutureDate(nextCheckDays);
    const level = needsAttention ? "重点观察" : score < 9.5 ? "稳定养护" : "状态优秀";
    const title = needsAttention ? "先稳住环境，再看新叶" : "按当前节奏继续养护";
    const reason = latestMoment
      ? `基于最近一次${latestMoment.modeLabel}和当前健康分 ${Number(plant.score).toFixed(1)} 生成。`
      : `基于植物百科和当前健康分 ${Number(plant.score).toFixed(1)} 生成。`;

    return {
      level,
      title,
      nextCheck,
      reason,
      actions: [
        `浇水：${plant.watering}`,
        `光照：${plant.light}`,
        `观察：${plant.focus}`
      ]
    };
  },

  formatFutureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  formatMomentDate(createdAt) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "未知时间";

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  },

  onShareAppMessage() {
    const plant = this.data.plant;

    return {
      title: plant ? `${plant.name} · 植物档案` : "植物档案 V2",
      path: plant ? `/pages/detail/detail?id=${encodeURIComponent(plant.id)}` : "/pages/index/index",
      imageUrl: "/plant-hero-morning.jpg"
    };
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

  chooseCover() {
    const plantId = this.data.plantId;
    if (!plantId) return;

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
            this.saveCover(plantId, saveResult.savedFilePath);
          },
          fail: () => {
            this.saveCover(plantId, tempFilePath);
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

  saveCover(plantId, cover) {
    const plant = this.loadPlant(plantId);
    if (!plant) return;

    const moments = plant.moments || [];
    const moment = buildAiMoment(plant, cover, "diagnose", this.loadPlants());
    if (!this.persistPlantOverride(plantId, {
      cover: plant.cover || cover,
      moments: [moment, ...moments]
    })) return;

    this.refreshPlant();
    wx.showToast({
      title: moments.length ? "已记录打卡" : "已加入植物",
      icon: "success"
    });
  },

  goHomeForEdit() {
    if (this.data.plantId) {
      wx.setStorageSync(PENDING_EDIT_KEY, this.data.plantId);
    }

    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.reLaunch({
          url: "/pages/index/index"
        });
      }
    });
  },

  loadPlant(plantId) {
    return this.loadPlants().find((plant) => plant.id === plantId);
  },

  loadPlants() {
    const overrides = wx.getStorageSync(STORAGE_KEY) || {};
    return mergePlantOverrides(defaultPlants, overrides);
  }
});
