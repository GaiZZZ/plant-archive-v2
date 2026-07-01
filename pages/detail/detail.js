const { defaultPlants, familyMeta } = require("../../utils/plants");
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

    this.setData({
      plant: {
        ...plant,
        scoreText: Number(plant.score).toFixed(1)
      },
      moments: (plant.moments || []).map((moment, index) => ({
        ...moment,
        displayDate: this.formatMomentDate(moment.createdAt),
        indexText: `第 ${plant.moments.length - index} 次打卡`
      })),
      familyColor: familyMeta[plant.code] ? familyMeta[plant.code].color : "#b4d4a8",
      scorePercent: `${Math.max(0, Math.min(100, Number(plant.score) * 10))}%`
    });
  },

  formatMomentDate(createdAt) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "未知时间";

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
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
    const moment = this.createMoment(plant, cover);
    if (!this.persistPlantOverride(plantId, {
      cover: plant.cover || cover,
      moments: [moment, ...moments]
    })) return;

    this.refreshPlant();
    wx.showToast({
      title: moments.length ? "已记录打卡" : "已点亮图鉴",
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
    const overrides = wx.getStorageSync(STORAGE_KEY) || {};
    return mergePlantOverrides(defaultPlants, overrides).find((plant) => plant.id === plantId);
  }
});
