import Foundation
import OSLog
import StoreKit

struct SupportProductPayload: Encodable {
    let id: String
    let displayName: String
    let displayPrice: String
}

enum SupportPurchaseResult {
    case purchased
    case pending
    case cancelled
    case failed
}

@MainActor
final class SupportStore: ObservableObject {
    static let productIDs = [
        "com.xiazishuo.app.support.small",
        "com.xiazishuo.app.support.medium",
        "com.xiazishuo.app.support.large",
    ]

    @Published private(set) var products: [Product] = []

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.xiazishuo.app",
        category: "support-store"
    )
    private var updateTask: Task<Void, Never>?
    private var purchaseInFlight = false

    deinit {
        updateTask?.cancel()
    }

    func start() async {
        observeTransactions()
        await loadProducts()
    }

    @discardableResult
    func loadProducts() async -> [SupportProductPayload] {
        do {
            let fetched = try await Product.products(for: Self.productIDs)
            products = fetched.sorted {
                (Self.productIDs.firstIndex(of: $0.id) ?? .max)
                    < (Self.productIDs.firstIndex(of: $1.id) ?? .max)
            }
            logger.info("operation=loadProducts status=succeeded count=\(self.products.count, privacy: .public)")
        } catch {
            products = []
            logger.error("operation=loadProducts status=failed")
        }
        return productPayloads
    }

    var productPayloads: [SupportProductPayload] {
        products.map {
            SupportProductPayload(id: $0.id, displayName: $0.displayName, displayPrice: $0.displayPrice)
        }
    }

    func purchase(productID: String) async -> SupportPurchaseResult {
        guard Self.productIDs.contains(productID), !purchaseInFlight else { return .failed }
        purchaseInFlight = true
        defer { purchaseInFlight = false }

        if products.first(where: { $0.id == productID }) == nil {
            await loadProducts()
        }
        guard let product = products.first(where: { $0.id == productID }) else { return .failed }

        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let transaction) = verification,
                      Self.productIDs.contains(transaction.productID) else {
                    logger.error("operation=purchase status=unverified product=\(productID, privacy: .public)")
                    return .failed
                }
                await transaction.finish()
                logger.info("operation=purchase status=succeeded product=\(productID, privacy: .public)")
                return .purchased
            case .pending:
                return .pending
            case .userCancelled:
                return .cancelled
            @unknown default:
                return .failed
            }
        } catch {
            logger.error("operation=purchase status=failed product=\(productID, privacy: .public)")
            return .failed
        }
    }

    private func observeTransactions() {
        guard updateTask == nil else { return }
        updateTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self,
                      case .verified(let transaction) = result,
                      Self.productIDs.contains(transaction.productID) else { continue }
                await transaction.finish()
                self.logger.info("operation=transactionUpdate status=finished product=\(transaction.productID, privacy: .public)")
            }
        }
    }
}
