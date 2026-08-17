(function () {
  "use strict";

  if (!["xiazishuo.com", "www.xiazishuo.com"].includes(window.location.hostname)) return;
  if (window.XiaziNativeBridge?.platform === "ios" || new URLSearchParams(window.location.search).get("surface") === "ios") return;

  const measurementId = "G-HDHST6WKKB";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const loader = document.createElement("script");
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(loader);
}());
