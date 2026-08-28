import StoreKit

@MainActor
final class SubscriptionManager: ObservableObject {
    @Published private(set) var hasAdFreeAccess = false

    private var transactionUpdatesTask: Task<Void, Never>?

    func start() async {
        if transactionUpdatesTask == nil {
            transactionUpdatesTask = Task { [weak self] in
                for await result in Transaction.updates {
                    guard let self else { return }
                    if case .verified(let transaction) = result {
                        await transaction.finish()
                    }
                    await self.refreshEntitlements()
                }
            }
        }

        await refreshEntitlements()
    }

    func refreshEntitlements() async {
        var isEntitled = false

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  AppConfiguration.subscriptionProductIDs.contains(transaction.productID),
                  transaction.revocationDate == nil else { continue }
            isEntitled = true
            break
        }

        hasAdFreeAccess = isEntitled
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }
}
