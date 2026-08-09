# 虾子曰 iOS

这是 `xiazishuo.com` 的在线优先 iOS 外壳。正文、海报、菜单和既有网页功能继续由生产 H5 提供；App 不复制一份网页资源，因此网站发布后，App 在下次启动、回到前台或下拉刷新时会读取同一版本。

## 本地运行

1. 用 Xcode 打开 `XiaziSays.xcodeproj`。
2. 选择共享 Scheme `XiaziSays` 和一个 iPhone 模拟器。
3. Run。Scheme 已绑定本地 `XiaziSays.storekit`，可测试三档消耗型“随喜相助”。

命令行构建：

```sh
xcodebuild -project XiaziSays.xcodeproj -scheme XiaziSays -sdk iphonesimulator -destination 'platform=iOS Simulator,name=Yixiu QA iPhone' CODE_SIGNING_ALLOWED=NO build
```

## 发布边界

- 普通 H5 内容、样式和既有交互：发布网站即可，App 不需要重新打包。
- StoreKit 商品、原生桥接、权限、推送、图标和启动资源：需要更新 iOS 工程并按 App Store 流程发布。
- iOS 内只展示 StoreKit 内购，不显示微信赞赏码或外部付款入口。
- `com.xiazishuo.app` 是当前工程的待确认 Bundle ID；创建 App Store Connect 记录前必须确认可用性。
- 首次发布前还需准备正式 App Icon、隐私政策/支持 URL、App Store 商品和审核说明；当前工程不会自动提交或发布。

## 桥接协议

网页向 `window.webkit.messageHandlers.xiaziNative` 发送：

- `support.products`：读取本地化商品与价格。
- `support.purchase`：携带 `payload.productId` 发起购买。

原生通过 `xiazi:native-message` 事件回传 `supportProducts` 或 `supportState`。产品 ID 在原生端使用白名单校验，网页不能请求任意商品。
