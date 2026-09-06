import Foundation
import WebKit

@MainActor
final class WebViewState: ObservableObject {
    enum LoadState {
        case loading
        case ready
        case failed
    }

    @Published private(set) var loadState: LoadState = .loading
    @Published private(set) var hasLoadedContent = false
    weak var webView: WKWebView?
    private var lastSuccessfulLoad = Date.distantPast

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    func markLoading() {
        loadState = .loading
    }

    func markReady(url: URL?) {
        loadState = .ready
        hasLoadedContent = true
        lastSuccessfulLoad = Date()
        if let url, AppConfiguration.isRestorableWebURL(url) {
            UserDefaults.standard.set(url.absoluteString, forKey: AppConfiguration.lastWebURLKey)
        }
    }

    func markFailed() {
        loadState = .failed
    }

    func reload() {
        guard let webView, !webView.isLoading else { return }
        loadState = .loading
        if webView.url == nil {
            webView.load(URLRequest(url: AppConfiguration.initialURL, timeoutInterval: 30))
        } else {
            webView.reload()
        }
    }

    func refreshIfStale() {
        guard hasLoadedContent || loadState == .failed else { return }
        guard Date().timeIntervalSince(lastSuccessfulLoad) > 300 else { return }
        reload()
    }
}
