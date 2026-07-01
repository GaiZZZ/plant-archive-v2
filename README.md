# 植物档案 V2

这是一个原生微信小程序版植物识别和养护工具，产品方向是“拍照识别 + 健康诊断 + 我的植物 + 成长档案”。当前版本以本地植物档案为基础：用户拍照后先看到识别或诊断结果，再决定是否加入我的植物并保存为生命周期记录；AI 识别和养护策略当前为体验占位，不需要登录和服务器。

## 快速开始

1. 用微信开发者工具导入当前目录
2. 开发阶段可以先使用测试 AppID
3. 编译后打开“植物档案首页”预览场景

导入前建议先运行：

```bash
npm run check
```

如需核对预计会进入微信上传包的文件：

```bash
npm run report:package
```

正式上传前，把 `project.config.json` 里的 `appid` 从 `touristappid` 替换为正式 AppID：

```bash
npm run set:appid -- wx1234567890abcdef
```

然后运行：

```bash
npm run check:release
```

## 当前小程序能力

- 学习 PictureThis 的推荐、诊断、识别、我的植物四入口首页结构
- 植物详情页，展示固定百科养护方案和生命周期时间线
- 预留拍照识别、健康诊断和 AI 养护策略卡
- 编辑评分、阶段、关注点和备注
- 拍照后先生成识别或诊断结果，再由用户选择是否加入我的植物或保存到成长档案
- 隐私与数据说明
- 本地备份与剪贴板恢复
- 分享首页和植物详情

## 上线材料

- 上线说明：`WECHAT-MINIPROGRAM.md`
- 提交清单：`MINIPROGRAM-SUBMISSION-CHECKLIST.md`
- 提审文案：`WECHAT-SUBMISSION-COPY.md`
- 头像和分享封面素材：`miniprogram-assets/`

`project.private.config.json` 只保存本地开发者工具偏好，已经从上传包中排除。
