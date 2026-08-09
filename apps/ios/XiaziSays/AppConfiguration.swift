import Foundation

enum AppConfiguration {
    static let shellVersion = "1.0.0"
    static let productionHost = "xiazishuo.com"
    static let lastWebURLKey = "xiazi.lastWebURL"

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
              isAllowed(url),
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
}
