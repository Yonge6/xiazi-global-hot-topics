import Foundation

enum AppConfiguration {
    static let shellVersion = "1.0.2"
    static let productionHost = "xiazishuo.com"
    static let lastWebURLKey = "xiazi.lastWebURL"
    static let adMobTestNativeAdUnitID = "ca-app-pub-3940256099942544/3986624511"
    static let subscriptionProductIDs = [
        "com.xiazishuo.app.adfree.monthly",
        "com.xiazishuo.app.adfree.annual",
    ]

    static var isChinese: Bool {
        Locale.preferredLanguages.first?.lowercased().hasPrefix("zh") == true
    }

    static var defaultURL: URL {
        let locale = isChinese ? "zh" : "en"
        return URL(string: "https://xiazishuo.com/\(locale)/?surface=ios")!
    }

    static var initialURL: URL {
#if DEBUG
        if let rawURL = ProcessInfo.processInfo.environment["XIAZI_QA_URL"],
           let url = URL(string: rawURL),
           isAllowed(url) {
            return url
        }
#endif
        guard let stored = UserDefaults.standard.string(forKey: lastWebURLKey),
              let url = URL(string: stored),
              isRestorableWebURL(url),
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return defaultURL
        }

        var queryItems = components.queryItems ?? []
        if !queryItems.contains(where: { $0.name == "surface" }) {
            queryItems.append(URLQueryItem(name: "surface", value: "ios"))
        }
        components.queryItems = queryItems
        return components.url ?? defaultURL
    }

    static func isAllowed(_ url: URL) -> Bool {
        url.scheme == "https" && url.host?.lowercased() == productionHost
    }

    static func isRestorableWebURL(_ url: URL) -> Bool {
        guard isAllowed(url) else { return false }
        return url.path == "/"
            || url.path == "/zh"
            || url.path.hasPrefix("/zh/")
            || url.path == "/en"
            || url.path.hasPrefix("/en/")
    }

    static var adMobNativeAdUnitID: String? {
#if DEBUG
        return adMobTestNativeAdUnitID
#else
        guard let value = Bundle.main.object(forInfoDictionaryKey: "XiaziAdMobNativeAdUnitID") as? String,
              value.hasPrefix("ca-app-pub-"),
              !value.contains("3940256099942544") else {
            return nil
        }
        return value
#endif
    }

    static var adMobIsConfigured: Bool {
        guard adMobNativeAdUnitID != nil,
              let appID = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String else {
            return false
        }
        return appID.hasPrefix("ca-app-pub-")
    }

    static var reportAdURL: URL {
        let subject = isChinese ? "举报虾子曰 App 广告" : "Report an ad in Xiazi Says"
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = "hustyy986@gmail.com"
        components.queryItems = [URLQueryItem(name: "subject", value: subject)]
        return components.url!
    }

    static var privacyURL: URL {
        URL(string: "https://xiazishuo.com/\(isChinese ? "zh" : "en")/privacy/")!
    }

    static var termsURL: URL {
        URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    }
}
