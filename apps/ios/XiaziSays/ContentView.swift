import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var webState: WebViewState
    @StateObject private var bridge: NativeBridge

    init() {
        let webState = WebViewState()
        _webState = StateObject(wrappedValue: webState)
        _bridge = StateObject(wrappedValue: NativeBridge())
    }

    var body: some View {
        ZStack {
            XiaziWebView(state: webState, bridge: bridge)
                .ignoresSafeArea(.container, edges: .bottom)

            if webState.loadState == .failed {
                OfflineView {
                    webState.reload()
                }
            }

            if webState.loadState == .loading {
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
        }
        .background(Color(red: 0.96, green: 0.93, blue: 0.86))
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            webState.refreshIfStale()
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
                Text("暂时无法连接")
                    .font(.system(size: 25, weight: .medium, design: .serif))
                Text("请检查网络后重试。已发布的 H5 内容不会丢失。")
                    .font(.system(size: 14, design: .serif))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("重新载入", action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.08, green: 0.38, blue: 0.40))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(32)
        .background(Color(red: 0.96, green: 0.93, blue: 0.86))
        .accessibilityElement(children: .contain)
    }
}
