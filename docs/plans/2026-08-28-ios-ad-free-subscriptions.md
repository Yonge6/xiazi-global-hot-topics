# Xiazi Says iOS Ad-Free Subscriptions

## Scope

- Add two auto-renewable StoreKit products in one subscription group:
  - `com.xiazishuo.app.adfree.monthly` — monthly, US$9.99.
  - `com.xiazishuo.app.adfree.annual` — annual, US$89.99, with a seven-day introductory free trial configured in App Store Connect.
- Both products grant the same entitlement: no AdMob advertising in the iOS app.
- Website AdSense remains unchanged.
- Add one environment-aware drawer row:
  - H5: open the public App Store URL.
  - iOS shell with subscription capability: open the native StoreKit subscription sheet.
  - Older iOS shells: hide the row so an unsupported action is never shown.

## Native flow

1. `SubscriptionManager` reads `Transaction.currentEntitlements` at launch and listens to `Transaction.updates`.
2. `SubscriptionStoreView` renders Apple-localized products, prices, eligibility, purchase, restore, and management controls.
3. `ContentView` enables AdMob only when no verified subscription entitlement exists.
4. The web bridge accepts `subscription.open` from the main frame and presents the native sheet.
5. No account, receipt database, or custom payment flow is introduced.

## Verification

- Web typecheck, lint, unit tests, and focused mobile Playwright coverage for H5 download and iOS subscription messages.
- iOS simulator build with StoreKit source compiling under the deployment target.
- Signed device build and install on the connected iPhone when available.
- App Store Connect products and the introductory offer are configured separately from source code and submitted with a new app version.
