import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var webState: WebViewState
    @StateObject private var bridge: NativeBridge
    @StateObject private var adMobManager: AdMobManager
    @State private var showingLaunchArtwork = true

    init() {
        let webState = WebViewState()
        _webState = StateObject(wrappedValue: webState)
        _bridge = StateObject(wrappedValue: NativeBridge())
        _adMobManager = StateObject(wrappedValue: AdMobManager())
    }

    var body: some View {
        ZStack {
            XiaziWebView(state: webState, bridge: bridge)
                .ignoresSafeArea(.container, edges: .bottom)
                .opacity(webState.hasLoadedContent ? 1 : 0)

            if webState.loadState == .failed {
                OfflineView {
                    webState.reload()
                }
            }

            if webState.loadState == .loading && !webState.hasLoadedContent {
                InitialLoadingView()
                    .transition(.opacity)
            } else if webState.loadState == .loading {
                VStack {
                    ProgressView()
                        .tint(Color(red: 0.10, green: 0.43, blue: 0.44))
                        .padding(10)
                        .background(.ultraThinMaterial, in: Circle())
                    Spacer()
                }
                .padding(.top, 10)
                .allowsHitTesting(false)
            }

            if showingLaunchArtwork {
                LaunchArtworkView()
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .background(Color(red: 0.96, green: 0.93, blue: 0.86))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if webState.hasLoadedContent && adMobManager.isConfigured {
                AdMobFooter(manager: adMobManager)
            }
        }
        .animation(.easeOut(duration: 0.22), value: webState.hasLoadedContent)
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            webState.refreshIfStale()
        }
        .task {
            adMobManager.start()
            guard showingLaunchArtwork else { return }
            try? await Task.sleep(for: .milliseconds(800))
            withAnimation(.easeOut(duration: 0.24)) {
                showingLaunchArtwork = false
            }
        }
    }
}

private struct LaunchArtworkView: View {
    var body: some View {
        ZStack {
            Color(red: 0.01, green: 0.07, blue: 0.12)
                .ignoresSafeArea()

            Image("LaunchArtwork")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                .ignoresSafeArea()
        }
        .accessibilityHidden(true)
    }
}

private struct InitialLoadingView: View {
    private let canvas = Color(red: 0.96, green: 0.93, blue: 0.86)
    private let ink = Color(red: 0.06, green: 0.08, blue: 0.09)
    private let vermilion = Color(red: 0.73, green: 0.20, blue: 0.14)
    private let line = Color(red: 0.80, green: 0.77, blue: 0.71)
    private let fill = Color(red: 0.89, green: 0.86, blue: 0.79)

    var body: some View {
        ZStack {
            canvas.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(fill)
                        .frame(width: 54, height: 48)
                    Spacer()
                    SkeletonBar(width: 50, height: 10, color: vermilion.opacity(0.45))
                    VStack(spacing: 5) {
                        SkeletonBar(width: 28, height: 3, color: ink.opacity(0.72))
                        SkeletonBar(width: 28, height: 3, color: ink.opacity(0.72))
                        SkeletonBar(width: 28, height: 3, color: ink.opacity(0.72))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)

                Rectangle()
                    .fill(line.opacity(0.75))
                    .frame(height: 1)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(fill.opacity(0.78))
                            .aspectRatio(1.02, contentMode: .fit)
                            .overlay {
                                VStack(spacing: 14) {
                                    SkeletonBar(width: 118, height: 8, color: vermilion.opacity(0.32))
                                    SkeletonBar(width: 205, height: 34, color: ink.opacity(0.12))
                                    SkeletonBar(width: 164, height: 13, color: ink.opacity(0.10))
                                }
                            }

                        Rectangle()
                            .fill(ink.opacity(0.72))
                            .frame(height: 1)
                            .padding(.top, 30)

                        HStack(spacing: 15) {
                            SkeletonBar(width: 66, height: 10, color: vermilion.opacity(0.52))
                            SkeletonBar(width: 126, height: 13, color: ink.opacity(0.28))
                        }
                        .padding(.top, 22)

                        HStack(spacing: 18) {
                            SkeletonBar(width: 70, height: 10, color: vermilion.opacity(0.52))
                            SkeletonBar(width: 122, height: 22, color: ink.opacity(0.35))
                        }
                        .padding(.top, 24)

                        Rectangle()
                            .fill(line)
                            .frame(height: 1)
                            .padding(.top, 20)

                        HStack {
                            SkeletonBar(width: 64, height: 10, color: vermilion.opacity(0.52))
                            Spacer()
                            SkeletonBar(width: 82, height: 9, color: ink.opacity(0.16))
                        }
                        .padding(.top, 22)

                        VStack(alignment: .leading, spacing: 10) {
                            SkeletonBar(height: 25, color: ink.opacity(0.25))
                            SkeletonBar(height: 25, color: ink.opacity(0.25))
                            SkeletonBar(width: 245, height: 25, color: ink.opacity(0.25))
                        }
                        .padding(.top, 23)

                        VStack(alignment: .leading, spacing: 11) {
                            SkeletonBar(height: 11, color: ink.opacity(0.12))
                            SkeletonBar(height: 11, color: ink.opacity(0.12))
                            SkeletonBar(width: 280, height: 11, color: ink.opacity(0.12))
                        }
                        .padding(.top, 27)
                        .padding(.bottom, 30)
                    }
                    .padding(.horizontal, 18)
                }
            }
        }
        .accessibilityLabel(AppConfiguration.isChinese ? "正在载入今日首页" : "Loading today's home page")
    }
}

private struct SkeletonBar: View {
    var width: CGFloat? = nil
    let height: CGFloat
    let color: Color

    var body: some View {
        Capsule()
            .fill(color)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .frame(width: width, height: height)
    }
}

private struct OfflineView: View {
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color(red: 0.08, green: 0.31, blue: 0.34))

            VStack(spacing: 9) {
                Text(AppConfiguration.isChinese ? "暂时无法连接" : "Unable to connect")
                    .font(.system(size: 25, weight: .medium, design: .serif))
                Text(AppConfiguration.isChinese
                     ? "请检查网络后重试。已发布的内容不会丢失。"
                     : "Check your connection and try again. Published editions remain online.")
                    .font(.system(size: 14, design: .serif))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button(AppConfiguration.isChinese ? "重新载入" : "Reload", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.08, green: 0.38, blue: 0.40))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(32)
        .background(Color(red: 0.96, green: 0.93, blue: 0.86))
        .accessibilityElement(children: .contain)
    }
}
