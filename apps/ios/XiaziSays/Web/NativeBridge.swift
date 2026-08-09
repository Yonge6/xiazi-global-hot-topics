import OSLog
import UIKit
import WebKit

@MainActor
final class NativeBridge: NSObject, ObservableObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    private let store: SupportStore
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.xiazishuo.app",
        category: "native-bridge"
    )

    init(store: SupportStore) {
        self.store = store
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "xiaziNative",
              message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "support.products":
            Task {
                emitSupportState("loading")
                await store.loadProducts()
                sendProducts()
            }
        case "support.purchase":
            guard let payload = body["payload"] as? [String: Any],
                  let productID = payload["productId"] as? String,
                  SupportStore.productIDs.contains(productID) else {
                emitSupportState("failed")
                return
            }
            Task {
                emitSupportState("purchasing")
                switch await store.purchase(productID: productID) {
                case .purchased:
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    emitSupportState("purchased")
                case .pending:
                    emitSupportState("pending")
                case .cancelled:
                    emitSupportState("cancelled")
                case .failed:
                    emitSupportState("failed")
                }
            }
        default:
            logger.notice("operation=receive status=unsupported type=\(type, privacy: .public)")
        }
    }

    func sendProducts() {
        let products = store.productPayloads
        emit(type: "supportProducts", values: ["products": products])
    }

    private func emitSupportState(_ status: String) {
        emit(type: "supportState", values: ["status": status])
    }

    private func emit(type: String, values: [String: Any]) {
        var payload = values
        payload["type"] = type

        let jsonObject: Any
        if let products = values["products"] as? [SupportProductPayload],
           let encoded = try? JSONEncoder().encode(products),
           let array = try? JSONSerialization.jsonObject(with: encoded) {
            payload["products"] = array
            jsonObject = payload
        } else {
            jsonObject = payload
        }

        guard JSONSerialization.isValidJSONObject(jsonObject),
              let data = try? JSONSerialization.data(withJSONObject: jsonObject),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('xiazi:native-message',{detail:\(json)}));"
        )
    }
}
