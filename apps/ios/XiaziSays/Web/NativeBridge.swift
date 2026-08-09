import OSLog
import UIKit
import WebKit

@MainActor
final class NativeBridge: NSObject, ObservableObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.xiazishuo.app",
        category: "native-bridge"
    )

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "xiaziNative",
              message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "poster.share":
            guard let payload = body["payload"] as? [String: Any],
                  let rawURL = payload["url"] as? String,
                  let url = URL(string: rawURL),
                  AppConfiguration.isAllowed(url) else { return }
            let title = payload["title"] as? String ?? "虾子曰"
            let text = payload["text"] as? String ?? ""
            Task {
                do {
                    let (data, response) = try await URLSession.shared.data(from: url)
                    guard let http = response as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode),
                          let image = UIImage(data: data) else { return }
                    presentShareSheet(image: image, title: title, text: text)
                } catch {
                    logger.error("operation=sharePoster status=failed")
                }
            }
        default:
            logger.notice("operation=receive status=unsupported type=\(type, privacy: .public)")
        }
    }

    private func presentShareSheet(image: UIImage, title: String, text: String) {
        let copy = [title, text].filter { !$0.isEmpty }.joined(separator: "\n\n")
        let controller = UIActivityViewController(
            activityItems: copy.isEmpty ? [image] : [image, copy],
            applicationActivities: nil
        )
        guard let presenter = webView?.nearestViewController?.topmostPresentedViewController else { return }
        controller.popoverPresentationController?.sourceView = webView
        controller.popoverPresentationController?.sourceRect = webView?.bounds ?? .zero
        presenter.present(controller, animated: true)
    }
}

private extension UIView {
    var nearestViewController: UIViewController? {
        sequence(first: next, next: { $0?.next })
            .first { $0 is UIViewController } as? UIViewController
    }
}

private extension UIViewController {
    var topmostPresentedViewController: UIViewController {
        if let presentedViewController {
            return presentedViewController.topmostPresentedViewController
        }
        if let navigationController = self as? UINavigationController,
           let visibleViewController = navigationController.visibleViewController {
            return visibleViewController.topmostPresentedViewController
        }
        if let tabBarController = self as? UITabBarController,
           let selectedViewController = tabBarController.selectedViewController {
            return selectedViewController.topmostPresentedViewController
        }
        return self
    }
}
