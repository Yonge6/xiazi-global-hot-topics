import { createHash, createHmac } from "node:crypto";

function hmacSha1(key: string, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function cosConfig() {
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  if (!secretId || !secretKey || !bucket || !region) {
    throw new Error("腾讯云 COS 尚未配置完成");
  }
  return { secretId, secretKey, bucket, region };
}

export async function uploadToCos(
  key: string,
  content: Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
) {
  const { secretId, secretKey, bucket, region } = cosConfig();
  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const pathname = `/${key.split("/").map(encodeURIComponent).join("/")}`;
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 3600}`;
  const httpString = `put\n${pathname}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(hmacSha1(secretKey, keyTime), stringToSign);
  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");

  let response: Response | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(`https://${host}${pathname}`, {
        method: "PUT",
        headers: {
          Authorization: authorization,
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
        },
        body: new Uint8Array(content),
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) break;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  if (!response) throw new Error("腾讯云海报同步失败");
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`腾讯云海报同步失败 (${response.status}) ${detail}`.trim());
  }
}

export async function copyCosObject(sourceKey: string, targetKey: string) {
  const { secretId, secretKey, bucket, region } = cosConfig();
  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const pathname = `/${targetKey.split("/").map(encodeURIComponent).join("/")}`;
  const copySource = `${host}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`;
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 3600}`;
  const canonicalCopySource = encodeURIComponent(copySource).replace(/%20/g, "+");
  const httpString = `put\n${pathname}\n\nhost=${host}&x-cos-copy-source=${canonicalCopySource}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(hmacSha1(secretKey, keyTime), stringToSign);
  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host;x-cos-copy-source",
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");

  const response = await fetch(`https://${host}${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "x-cos-copy-source": copySource,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`腾讯云对象归档失败 (${response.status}) ${detail}`.trim());
  }
}
