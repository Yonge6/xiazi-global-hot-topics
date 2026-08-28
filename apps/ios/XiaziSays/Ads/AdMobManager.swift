import Foundation
@preconcurrency import GoogleMobileAds
import UserMessagingPlatform

@MainActor
final class AdMobManager: NSObject, ObservableObject {
    @Published private(set) var nativeAd: NativeAd?
    @Published private(set) var isPrivacyOptionsRequired = false

    private var adLoader: AdLoader?
    private var hasStartedConsentFlow = false
    private var hasStartedMobileAds = false
    private var adsEnabled = false

    var isConfigured: Bool {
        AppConfiguration.adMobIsConfigured
    }

    func start() {
        guard isConfigured else { return }
        adsEnabled = true
        if hasStartedConsentFlow {
            startMobileAdsIfAllowed()
            return
        }
        hasStartedConsentFlow = true
        MobileAds.shared.requestConfiguration.setPublisherFirstPartyIDEnabled(false)

        Task { @MainActor in
            do {
                try await ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters())
                try await ConsentForm.loadAndPresentIfRequired(from: nil)
            } catch {
#if DEBUG
                print("AdMob consent flow: \(error.localizedDescription)")
#endif
            }

            refreshPrivacyOptionsState()
            startMobileAdsIfAllowed()
        }
    }

    func stop() {
        adsEnabled = false
        nativeAd = nil
        adLoader?.delegate = nil
        adLoader = nil
    }

    func presentPrivacyOptions() {
        guard isPrivacyOptionsRequired else { return }
        Task { @MainActor in
            do {
                try await ConsentForm.presentPrivacyOptionsForm(from: nil)
            } catch {
#if DEBUG
                print("AdMob privacy options: \(error.localizedDescription)")
#endif
            }
            refreshPrivacyOptionsState()
            startMobileAdsIfAllowed()
        }
    }

    private func refreshPrivacyOptionsState() {
        isPrivacyOptionsRequired = ConsentInformation.shared.privacyOptionsRequirementStatus == .required
    }

    private func startMobileAdsIfAllowed() {
        guard adsEnabled, ConsentInformation.shared.canRequestAds else { return }
        if !hasStartedMobileAds {
            hasStartedMobileAds = true
            MobileAds.shared.start()
        }
        loadNativeAd()
    }

    private func loadNativeAd() {
        guard adsEnabled,
              nativeAd == nil,
              adLoader == nil,
              let adUnitID = AppConfiguration.adMobNativeAdUnitID else { return }
        let loader = AdLoader(
            adUnitID: adUnitID,
            rootViewController: nil,
            adTypes: [.native],
            options: nil
        )
        loader.delegate = self
        adLoader = loader

        let request = Request()
        let extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        request.register(extras)
        loader.load(request)
    }
}

extension AdMobManager: NativeAdLoaderDelegate {
    func adLoader(_ adLoader: AdLoader, didReceive nativeAd: NativeAd) {
        self.adLoader = nil
        guard adsEnabled else { return }
        self.nativeAd = nativeAd
    }

    func adLoader(_ adLoader: AdLoader, didFailToReceiveAdWithError error: Error) {
        self.adLoader = nil
#if DEBUG
        print("AdMob native ad: \(error.localizedDescription)")
#endif
    }
}
