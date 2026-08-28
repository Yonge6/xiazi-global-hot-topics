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
        case "poster.save":
            guard let payload = body["payload"] as? [String: Any],
                  let rawURL = payload["url"] as? String,
                  let url = URL(string: rawURL),
                  AppConfiguration.isAllowed(url) else { return }
            let requestedFilename = payload["filename"] as? String
            let filename = safeFilename(requestedFilename, fallback: url.lastPathComponent)
            Task {
                await presentPosterSaveSheet(from: url, filename: filename)
            }
        default:
            logger.notice("operation=receive status=unsupported type=\(type, privacy: .public)")
        }
    }

    private func presentPosterSaveSheet(from url: URL, filename: String) async {
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  UIImage(data: data) != nil else {
                presentSaveFailure()
                return
            }
            let temporaryDirectory = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(
                at: temporaryDirectory,
                withIntermediateDirectories: true
            )
            let fileURL = temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: fileURL, options: .atomic)
            presentPosterSaveSheet(fileURL: fileURL, temporaryDirectory: temporaryDirectory)
        } catch {
            logger.error("operation=savePoster status=failed")
            presentSaveFailure()
        }
    }

    private func safeFilename(_ requested: String?, fallback: String) -> String {
        let candidate = requested?.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = candidate.flatMap { $0.isEmpty ? nil : $0 } ?? fallback
        let lastComponent = URL(fileURLWithPath: source).lastPathComponent
        return lastComponent.lowercased().hasSuffix(".png") ? lastComponent : "xiazi-poster.png"
    }

    private func presentSaveFailure() {
        presentAlert(
            title: AppConfiguration.isChinese ? "保存失败" : "Save Failed",
            message: AppConfiguration.isChinese ? "请稍后重试。" : "Please try again."
        )
    }

    private func presentAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: AppConfiguration.isChinese ? "好" : "OK", style: .default))
        present(alert)
    }

    private func present(_ controller: UIViewController) {
        guard let presenter = webView?.nearestViewController?.topmostPresentedViewController else { return }
        presenter.present(controller, animated: true)
    }

    private func presentShareSheet(image: UIImage, title: String, text: String) {
        let copy = [title, text].filter { !$0.isEmpty }.joined(separator: "\n\n")
        let controller = UIActivityViewController(
            activityItems: copy.isEmpty ? [image] : [image, copy],
            applicationActivities: nil
        )
        controller.popoverPresentationController?.sourceView = webView
        controller.popoverPresentationController?.sourceRect = webView?.bounds ?? .zero
        present(controller)
    }

    private func presentPosterSaveSheet(fileURL: URL, temporaryDirectory: URL) {
        let controller = UIActivityViewController(
            activityItems: [fileURL],
            applicationActivities: nil
        )
        controller.popoverPresentationController?.sourceView = webView
        controller.popoverPresentationController?.sourceRect = webView?.bounds ?? .zero
        controller.completionWithItemsHandler = { [weak self] activityType, completed, _, _ in
            try? FileManager.default.removeItem(at: temporaryDirectory)
            guard completed, activityType == .saveToCameraRoll else { return }
            Task { @MainActor in
                self?.logger.notice("operation=savePoster status=succeeded")
                self?.showSaveSuccessToast()
            }
        }
        present(controller)
    }

    private func showSaveSuccessToast() {
        guard let webView else { return }
        let toast = UILabel()
        toast.translatesAutoresizingMaskIntoConstraints = false
        toast.text = AppConfiguration.isChinese ? "成功保存到相册" : "Saved to Photos"
        toast.textAlignment = .center
        toast.font = .preferredFont(forTextStyle: .footnote)
        toast.textColor = .systemBackground
        toast.backgroundColor = UIColor.label.withAlphaComponent(0.9)
        toast.layer.cornerRadius = 16
        toast.layer.masksToBounds = true
        toast.alpha = 0
        toast.accessibilityIdentifier = "poster-save-success"
        webView.addSubview(toast)
        NSLayoutConstraint.activate([
            toast.centerXAnchor.constraint(equalTo: webView.centerXAnchor),
            toast.bottomAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            toast.heightAnchor.constraint(equalToConstant: 32),
            toast.widthAnchor.constraint(greaterThanOrEqualToConstant: 132),
        ])
        UIView.animate(withDuration: 0.18, animations: {
            toast.alpha = 1
        }) { _ in
            UIView.animate(
                withDuration: 0.2,
                delay: 1.4,
                options: [.curveEaseInOut],
                animations: { toast.alpha = 0 },
                completion: { _ in toast.removeFromSuperview() }
            )
        }
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
