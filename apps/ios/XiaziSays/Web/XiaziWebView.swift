import SwiftUI
import UIKit
import WebKit

struct XiaziWebView: UIViewRepresentable {
    @ObservedObject var state: WebViewState
    @ObservedObject var bridge: NativeBridge

    func makeCoordinator() -> Coordinator {
        Coordinator(state: state, bridge: bridge)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(bridge, name: "xiaziNative")
        contentController.addUserScript(WKUserScript(
            source: Self.bridgeBootstrap,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "XiaziSays/\(AppConfiguration.shellVersion)"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.96, green: 0.93, blue: 0.86, alpha: 1)
        webView.underPageBackgroundColor = webView.backgroundColor
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        webView.scrollView.keyboardDismissMode = .interactive
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        state.attach(webView)
        bridge.webView = webView
        webView.load(URLRequest(
            url: AppConfiguration.initialURL,
            cachePolicy: .useProtocolCachePolicy,
            timeoutInterval: 30
        ))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        bridge.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "xiaziNative")
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    private static let bridgeBootstrap = """
    Object.defineProperty(window, 'XiaziNativeBridge', {
      value: Object.freeze({
        platform: 'ios',
        shellVersion: '\(AppConfiguration.shellVersion)',
        capabilities: Object.freeze(['poster.share'])
      }),
      configurable: false,
      writable: false
    });
    const markNativeSurface = () => {
      if (document.documentElement) document.documentElement.dataset.nativeApp = 'ios';
    };
    markNativeSurface();
    document.addEventListener('DOMContentLoaded', markNativeSurface, { once: true });
    """

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let state: WebViewState
        private let bridge: NativeBridge

        init(state: WebViewState, bridge: NativeBridge) {
            self.state = state
            self.bridge = bridge
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            state.markLoading()
            state.webView?.reload()
            sender.endRefreshing()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.markLoading()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            state.markReady(url: webView.url)
            if let fragment = webView.url?.fragment, !fragment.isEmpty {
                let encoded = fragment.replacingOccurrences(of: "'", with: "\\'")
                webView.evaluateJavaScript(
                    "document.getElementById(decodeURIComponent('\(encoded)'))?.scrollIntoView({block: 'start'})"
                )
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            state.markFailed()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            state.markFailed()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if AppConfiguration.isAllowed(url) {
                if navigationAction.targetFrame == nil {
                    webView.load(navigationAction.request)
                    decisionHandler(.cancel)
                } else {
                    decisionHandler(.allow)
                }
                return
            }

            if ["https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }
            if AppConfiguration.isAllowed(url) {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
