import StoreKit
import SwiftUI

struct SubscriptionPaywall: View {
    @ObservedObject var manager: SubscriptionManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SubscriptionStoreView(productIDs: AppConfiguration.subscriptionProductIDs) {
                    VStack(spacing: 14) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 32, weight: .light))
                            .foregroundStyle(Color(red: 0.72, green: 0.47, blue: 0.14))

                        Text(AppConfiguration.isChinese ? "清净阅读，无广告打扰" : "Read without advertising")
                            .font(.system(.title2, design: .serif, weight: .semibold))
                            .multilineTextAlignment(.center)

                        Text(
                            AppConfiguration.isChinese
                                ? "订阅后，虾子曰 iOS App 将不再展示广告。网站广告不受影响。"
                                : "Your subscription removes ads from the Xiazi Says iOS app. Website advertising is unchanged."
                        )
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 22)
                    }
                    .padding(.top, 18)
                }
                .subscriptionStoreControlStyle(.prominentPicker)
                .subscriptionStoreButtonLabel(.multiline)
                .storeButton(.visible, for: .restorePurchases)

                HStack(spacing: 18) {
                    Link(
                        AppConfiguration.isChinese ? "隐私政策" : "Privacy Policy",
                        destination: AppConfiguration.privacyURL
                    )
                    Link(
                        AppConfiguration.isChinese ? "使用条款" : "Terms of Use",
                        destination: AppConfiguration.termsURL
                    )
                }
                .font(.caption)
                .padding(.vertical, 14)
            }
            .background(Color(red: 0.96, green: 0.93, blue: 0.86))
            .navigationTitle(AppConfiguration.isChinese ? "去除广告" : "Remove Ads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(AppConfiguration.isChinese ? "完成" : "Done") {
                        dismiss()
                    }
                }
            }
            .task {
                await manager.refreshEntitlements()
            }
            .onChange(of: manager.hasAdFreeAccess) { _, hasAccess in
                if hasAccess { dismiss() }
            }
        }
    }
}
