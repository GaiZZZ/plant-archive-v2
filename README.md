# 植物档案 V2

这是一个原生微信小程序版植物养护工具。当前版本以本地植物档案为基础，并预留 AI 诊断入口：植物评分、备注和封面保存在当前微信客户端缓存中，不需要登录和服务器；AI 诊断结果区当前为体验占位。

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

- 今日养护台、AI 诊断入口、档案三块首页结构
- 植物详情页
- 编辑评分、阶段、关注点和备注
- 上传或更换植物封面
- 隐私与数据说明
- 本地备份与剪贴板恢复
- 分享首页和植物详情

## 上线材料

- 上线说明：`WECHAT-MINIPROGRAM.md`
- 提交清单：`MINIPROGRAM-SUBMISSION-CHECKLIST.md`
- 提审文案：`WECHAT-SUBMISSION-COPY.md`
- 头像和分享封面素材：`miniprogram-assets/`

`project.private.config.json` 只保存本地开发者工具偏好，已经从上传包中排除。
