const { defaultPlants } = require("../../utils/plants");
const {
  STORAGE_KEY,
  countArchiveOverrides,
  createArchiveBackup,
  parseArchiveBackup
} = require("../../utils/storage");

Page({
  onShareAppMessage() {
    return {
      title: "植物档案 V2 · 隐私与数据说明",
      path: "/pages/privacy/privacy",
      imageUrl: "/plant-hero-morning.jpg"
    };
  },

  copyBackup() {
    let backupText = "";

    try {
      const overrides = wx.getStorageSync(STORAGE_KEY) || {};
      backupText = createArchiveBackup(overrides);
    } catch (error) {
      wx.showToast({
        title: "生成备份失败",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: backupText,
      success: () => {
        wx.showToast({
          title: "备份已复制",
          icon: "success"
        });
      },
      fail: () => {
        wx.showToast({
          title: "复制备份失败",
          icon: "none"
        });
      }
    });
  },

  restoreBackup() {
    wx.getClipboardData({
      success: (res) => {
        this.confirmRestore(res.data || "");
      },
      fail: () => {
        wx.showToast({
          title: "读取剪贴板失败",
          icon: "none"
        });
      }
    });
  },

  confirmRestore(rawText) {
    let overrides = null;

    try {
      overrides = parseArchiveBackup(
        rawText,
        defaultPlants.map((plant) => plant.id)
      );
    } catch (error) {
      wx.showToast({
        title: "备份内容无效",
        icon: "none"
      });
      return;
    }

    const restoredCount = countArchiveOverrides(overrides);
    const confirmContent = restoredCount
      ? `将使用剪贴板里的备份覆盖当前本地修改，可恢复 ${restoredCount} 条植物记录。`
      : "备份中没有可恢复的本地修改，将清空当前本地修改。";

    wx.showModal({
      title: "恢复本地档案",
      content: confirmContent,
      confirmText: "恢复",
      confirmColor: "#47795e",
      success: (modalResult) => {
        if (!modalResult.confirm) return;

        try {
          wx.setStorageSync(STORAGE_KEY, overrides);
          wx.showToast({
            title: restoredCount ? `已恢复${restoredCount}条` : "已清空修改",
            icon: "success"
          });
        } catch (error) {
          wx.showToast({
            title: "恢复失败",
            icon: "none"
          });
        }
      }
    });
  }
});
