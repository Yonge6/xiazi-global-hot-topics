import SwiftUI
@preconcurrency import GoogleMobileAds

struct AdMobFooter: View {
    @ObservedObject var manager: AdMobManager
    @Environment(\.openURL) private var openURL
    @State private var isDismissed = false

    var body: some View {
        Group {
            if let nativeAd = manager.nativeAd, !isDismissed {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Color(red: 0.80, green: 0.77, blue: 0.71).opacity(0.72))
                        .frame(height: 1)

                    HStack(spacing: 10) {
                        AdMobNativeView(nativeAd: nativeAd)
                            .frame(maxWidth: .infinity)
                            .frame(height: 104)

                        Menu {
                            Button {
                                openURL(AppConfiguration.reportAdURL)
                            } label: {
                                Label(
                                    AppConfiguration.isChinese ? "举报这条广告" : "Report this ad",
                                    systemImage: "exclamationmark.bubble"
                                )
                            }

                            if manager.isPrivacyOptionsRequired {
                                Button {
                                    manager.presentPrivacyOptions()
                                } label: {
                                    Label(
                                        AppConfiguration.isChinese ? "隐私选项" : "Privacy choices",
                                        systemImage: "hand.raised"
                                    )
                                }
                            }

                            Button(role: .destructive) {
                                isDismissed = true
                            } label: {
                                Label(
                                    AppConfiguration.isChinese ? "隐藏广告" : "Hide ad",
                                    systemImage: "xmark"
                                )
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Color(red: 0.08, green: 0.31, blue: 0.34))
                                .frame(width: 38, height: 44)
                                .contentShape(Rectangle())
                        }
                        .accessibilityLabel(AppConfiguration.isChinese ? "广告选项" : "Ad options")
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 4)
                }
                .background(Color(red: 0.96, green: 0.93, blue: 0.86))
            } else if manager.isPrivacyOptionsRequired {
                Button {
                    manager.presentPrivacyOptions()
                } label: {
                    Label(
                        AppConfiguration.isChinese ? "广告隐私选项" : "Ad privacy choices",
                        systemImage: "hand.raised"
                    )
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(red: 0.08, green: 0.31, blue: 0.34))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                }
                .background(Color(red: 0.96, green: 0.93, blue: 0.86))
            }
        }
    }
}

private struct AdMobNativeView: UIViewRepresentable {
    let nativeAd: NativeAd

    func makeUIView(context: Context) -> NativeAdView {
        CompactNativeAdView()
    }

    func updateUIView(_ nativeAdView: NativeAdView, context: Context) {
        guard let view = nativeAdView as? CompactNativeAdView else { return }
        view.populate(with: nativeAd)
    }
}

private final class CompactNativeAdView: NativeAdView {
    private let attributionLabel = UILabel()
    private let iconImageView = UIImageView()
    private let headlineLabel = UILabel()
    private let advertiserLabel = UILabel()
    private let bodyLabel = UILabel()
    private let callToActionButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        configureViews()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configureViews()
    }

    private func configureViews() {
        backgroundColor = .clear

        attributionLabel.text = AppConfiguration.isChinese ? "广告" : "Ad"
        attributionLabel.font = .systemFont(ofSize: 10, weight: .semibold)
        attributionLabel.textColor = UIColor(red: 0.65, green: 0.43, blue: 0.15, alpha: 1)

        iconImageView.contentMode = .scaleAspectFill
        iconImageView.clipsToBounds = true
        iconImageView.layer.cornerRadius = 10
        iconImageView.backgroundColor = UIColor(red: 0.89, green: 0.86, blue: 0.79, alpha: 1)

        headlineLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        headlineLabel.textColor = UIColor(red: 0.06, green: 0.08, blue: 0.09, alpha: 1)
        headlineLabel.numberOfLines = 1

        advertiserLabel.font = .systemFont(ofSize: 11, weight: .regular)
        advertiserLabel.textColor = UIColor.secondaryLabel
        advertiserLabel.numberOfLines = 1

        bodyLabel.font = .systemFont(ofSize: 11, weight: .regular)
        bodyLabel.textColor = UIColor.secondaryLabel
        bodyLabel.numberOfLines = 2

        callToActionButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        callToActionButton.tintColor = .white
        callToActionButton.backgroundColor = UIColor(red: 0.08, green: 0.38, blue: 0.40, alpha: 1)
        callToActionButton.layer.cornerRadius = 15
        callToActionButton.isUserInteractionEnabled = false

        [attributionLabel, iconImageView, headlineLabel, advertiserLabel, bodyLabel, callToActionButton]
            .forEach {
                $0.translatesAutoresizingMaskIntoConstraints = false
                addSubview($0)
            }

        headlineView = headlineLabel
        advertiserView = advertiserLabel
        bodyView = bodyLabel
        iconView = iconImageView
        callToActionView = callToActionButton

        NSLayoutConstraint.activate([
            attributionLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            attributionLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),

            iconImageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            iconImageView.topAnchor.constraint(equalTo: attributionLabel.bottomAnchor, constant: 5),
            iconImageView.widthAnchor.constraint(equalToConstant: 52),
            iconImageView.heightAnchor.constraint(equalToConstant: 52),

            callToActionButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            callToActionButton.centerYAnchor.constraint(equalTo: iconImageView.centerYAnchor),
            callToActionButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 66),
            callToActionButton.heightAnchor.constraint(equalToConstant: 30),

            headlineLabel.leadingAnchor.constraint(equalTo: iconImageView.trailingAnchor, constant: 9),
            headlineLabel.trailingAnchor.constraint(lessThanOrEqualTo: callToActionButton.leadingAnchor, constant: -9),
            headlineLabel.topAnchor.constraint(equalTo: iconImageView.topAnchor),

            advertiserLabel.leadingAnchor.constraint(equalTo: headlineLabel.leadingAnchor),
            advertiserLabel.trailingAnchor.constraint(lessThanOrEqualTo: callToActionButton.leadingAnchor, constant: -9),
            advertiserLabel.topAnchor.constraint(equalTo: headlineLabel.bottomAnchor, constant: 3),

            bodyLabel.leadingAnchor.constraint(equalTo: headlineLabel.leadingAnchor),
            bodyLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            bodyLabel.topAnchor.constraint(equalTo: advertiserLabel.bottomAnchor, constant: 5),
            bodyLabel.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -8),
        ])
    }

    func populate(with ad: NativeAd) {
        headlineLabel.text = ad.headline
        advertiserLabel.text = ad.advertiser
        advertiserLabel.isHidden = ad.advertiser == nil
        bodyLabel.text = ad.body
        bodyLabel.isHidden = ad.body == nil
        iconImageView.image = ad.icon?.image
        iconImageView.isHidden = ad.icon == nil
        callToActionButton.setTitle(ad.callToAction, for: .normal)
        callToActionButton.isHidden = ad.callToAction == nil
        nativeAd = ad
    }
}
