# 虾子曰 iOS

这是 `xiazishuo.com` 的在线优先 iOS 外壳。正文、海报、菜单和既有网页功能继续由生产 H5 提供；App 不复制一份网页资源，因此网站发布后，App 在下次启动、回到前台或下拉刷新时会读取同一版本。

## 本地运行

1. 用 Xcode 打开 `XiaziSays.xcodeproj`。
2. 选择共享 Scheme `XiaziSays` 和一个 iPhone 模拟器。
3. Run。App 使用苹果标准安全区，并通过系统分享面板保存或分享海报。

命令行构建：

```sh
xcodebuild -project XiaziSays.xcodeproj -scheme XiaziSays -sdk iphonesimulator -destination 'platform=iOS Simulator,name=Yixiu QA iPhone' CODE_SIGNING_ALLOWED=NO build
```

## 发布边界

- 普通 H5 内容、样式和既有交互：发布网站即可，App 不需要重新打包。
- 原生分享、权限、推送、图标和启动资源：需要更新 iOS 工程并按 App Store 流程发布。
- iOS 内不展示“随喜相助”或任何付款入口；网页版继续保留该栏目。
- Bundle ID 为 `com.xiazishuo.app`，App Store Connect 主要语言为英语（美国），简体中文为第二本地化。
- 英文设备首次打开 `/en/`，中文设备首次打开 `/zh/`；之后保留用户最后阅读的同站页面。
- iOS 端关闭网站匿名统计，不展示“随喜相助”或付款入口；隐私清单声明仅以 `CA92.1` 理由使用 App 自身的 UserDefaults。
- App Store 支持页为 `/en/support/` 与 `/zh/support/`，隐私页为 `/en/privacy/` 与 `/zh/privacy/`。

## AdMob 原生广告

- Debug 使用 Google 官方 iOS 原生测试广告位，不关联任何真实广告账户。
- Release 在未配置正式 `GADApplicationIdentifier` 和 `XiaziAdMobNativeAdUnitID` 时自动关闭广告，不会把测试广告带入 App Store。
- 广告在 H5 加载完成后显示于底部安全区，可隐藏、举报；需要时提供 UMP 隐私选项入口。
- 所有请求固定为非个性化广告；当前不请求 ATT，也不使用 IDFA 做跨 App 跟踪。
- 上线正式广告前必须在 AdMob 创建 App 与 Native ad unit、配置 Privacy & messaging，并同步更新 App Store Connect 隐私标签及网站隐私政策。Google Mobile Ads SDK 仍可能处理 IP、设备标识符、广告互动与诊断数据。

## 桥接协议

网页向 `window.webkit.messageHandlers.xiaziNative` 发送：

- `poster.share`：携带同源海报 URL、标题和正文，打开苹果系统分享面板。
- `poster.save`：携带同源海报 URL 和文件名，以原始 PNG 文件打开系统分享面板；选择“保存图像”成功后显示轻量反馈。

原生只接受 `https://xiazishuo.com` 的海报 URL；系统分享面板负责分享、复制和存储到照片等动作。
