function ensurePrivacyAuthorized(onAuthorized) {
  if (typeof wx === "undefined" || typeof wx.requirePrivacyAuthorize !== "function") {
    onAuthorized();
    return;
  }

  wx.requirePrivacyAuthorize({
    success() {
      onAuthorized();
    },
    fail() {
      wx.showToast({
        title: "请先同意隐私授权",
        icon: "none"
      });
    }
  });
}

module.exports = {
  ensurePrivacyAuthorized
};
