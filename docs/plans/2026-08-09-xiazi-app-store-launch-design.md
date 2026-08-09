# Xiazi Says App Store launch design

Date: 2026-08-09

## Product and distribution

- App identity: Xiazi Says / 虾子曰
- Bundle ID: `com.xiazishuo.app`
- Version/build: `1.0` (`1`)
- Primary localization: English (U.S.); secondary localization: Simplified Chinese
- Distribution: public, free, manual release, all App Store regions except China mainland until the required ICP and Internet News Information permits are available
- The iOS app remains an online-first reader so daily H5 editorial updates appear without a binary release

## Native value

- System share sheet for complete poster images
- Pull-to-refresh and refresh-on-return behavior
- Native offline/error recovery screen
- Safe-area-aware iPhone presentation and external-link handoff
- Locale-aware English or Chinese first launch

## Privacy

- No account, advertising, cross-app tracking, or in-app payment
- Anonymous website analytics are disabled when `surface=ios`
- Theme and last-reading location remain on device
- `PrivacyInfo.xcprivacy` declares UserDefaults reason `CA92.1` and no collected data

## Store assets

- Image2 creates the text-free 1024-square brand icon from the canonical Xiazi reference
- App Store screenshots use real app captures placed on Image2-created editorial backgrounds; generated UI is not presented as a product feature
- English screenshots are uploaded first, followed by Simplified Chinese equivalents

## Review positioning

The review notes call out the native share bridge, pull-to-refresh, offline recovery, bilingual daily editions, and live editorial publishing model. No donation or payment entry is exposed in the iOS surface.
