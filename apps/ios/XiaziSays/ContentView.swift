import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var webState: WebViewState
    @StateObject private var bridge: NativeBridge
    @State private var showingLaunchArtwork = true

    init() {
        let webState = WebViewState()
        _webState = StateObject(wrappedValue: webState)
        _bridge = StateObject(wrappedValue: NativeBridge())
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
        .animation(.easeOut(duration: 0.22), value: webState.hasLoadedContent)
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            webState.refreshIfStale()
        }
        .task {
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
        Image("LaunchArtwork")
            .resizable()
            .scaledToFill()
            .ignoresSafeArea()
            .accessibilityHidden(true)
    }
}

private struct InitialLoadingView: View {
    private let canvas = Color(red: 0.96, green: 0.93, blue: 0.86)
    private let jade = Color(red: 0.08, green: 0.31, blue: 0.34)
    private let gold = Color(red: 0.72, green: 0.52, blue: 0.24)
    private let warmPanel = Color(red: 0.91, green: 0.84, blue: 0.70)
    private let coolPanel = Color(red: 0.69, green: 0.80, blue: 0.77)
    private let quietPanel = Color(red: 0.84, green: 0.78, blue: 0.68)

    var body: some View {
        ZStack {
            canvas.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Text("虾子曰 · XIAZI SAYS")
                    .font(.system(size: 12, weight: .semibold, design: .serif))
                    .tracking(1.8)
                    .foregroundStyle(gold)

                Text(AppConfiguration.isChinese ? "你的世界" : "Your World")
                    .font(.system(size: 34, weight: .medium, design: .serif))
                    .foregroundStyle(jade)
                    .padding(.top, 8)

                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(AppConfiguration.isChinese ? "今日刊物" : "TODAY'S EDITION")
                            .font(.system(size: 11, weight: .semibold, design: .serif))
                            .tracking(1.4)
                            .foregroundStyle(gold)
                        Text(AppConfiguration.isChinese
                             ? "全球热点 · 双语视觉海报"
                             : "Global stories · Bilingual visual posters")
                            .font(.system(size: 16, weight: .medium, design: .serif))
                            .foregroundStyle(jade)
                    }

                    Spacer()

                    ProgressView()
                        .tint(jade)
                        .accessibilityLabel(AppConfiguration.isChinese ? "正在载入" : "Loading")
                }
                .padding(.top, 34)
                .padding(.bottom, 22)

                VStack(spacing: 14) {
                    LoadingBlock(color: warmPanel, height: 108, accent: gold)
                    LoadingBlock(color: coolPanel, height: 148, accent: jade)
                    LoadingBlock(color: quietPanel, height: 92, accent: gold)
                }

                Spacer(minLength: 28)

                Text(AppConfiguration.isChinese
                     ? "正在连接今天的世界…"
                     : "Connecting to today's world…")
                    .font(.system(size: 14, design: .serif))
                    .foregroundStyle(jade.opacity(0.72))
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 22)
        }
        .accessibilityElement(children: .contain)
    }
}

private struct LoadingBlock: View {
    let color: Color
    let height: CGFloat
    let accent: Color

    var body: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(color.opacity(0.72))
            .frame(height: height)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(accent.opacity(0.72))
                    .frame(width: 5, height: height - 30)
                    .padding(.leading, 16)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(accent.opacity(0.22), lineWidth: 1)
            }
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
