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
        if let url, AppConfiguration.isAllowed(url) {
            UserDefaults.standard.set(url.absoluteString, forKey: AppConfiguration.lastWebURLKey)
        }
    }

    func markFailed() {
        loadState = .failed
    }

    func reload() {
        loadState = .loading
        if let webView {
            webView.reload()
        }
    }

    func refreshIfStale() {
        guard Date().timeIntervalSince(lastSuccessfulLoad) > 300 else { return }
        reload()
    }
}
