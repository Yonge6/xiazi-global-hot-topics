export const PRODUCTION_DOMAIN = "xiazishuo.com";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`;

export function productionUrl(pathname = "/") {
  return new URL(pathname, `${PRODUCTION_ORIGIN}/`).toString();
}
