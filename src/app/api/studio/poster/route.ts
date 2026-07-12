import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { copyCosObject, uploadToCos } from "@/lib/cos/storage";
import { githubRepo } from "@/lib/github/repo";
import { resolvePosterName } from "@/lib/posters/assets";
import { imageContentType, posterVersion } from "@/lib/posters/image-bytes";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";

function encode(content: Buffer) {
  return content.toString("base64");
}

async function github(path: string, init?: RequestInit) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new Error("服务器尚未配置 GitHub 海报发布权限");

  const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(detail?.message || "GitHub 海报发布失败");
  return detail;
}

async function currentSha(path: string) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) return undefined;

  const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return undefined;
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(detail?.message || "GitHub 海报状态读取失败");
  return detail.sha as string;
}

async function writeGitHubAsset(path: string, content: Buffer, message: string) {
  const sha = await currentSha(path);
  await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encode(content),
      ...(sha ? { sha } : {}),
    }),
  });
}

async function tryCos(action: () => Promise<void>, warnings: string[]) {
  try {
    await action();
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "COS 同步失败");
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const locale = form.get("locale");
    const slug = String(form.get("slug") || "");
    const issueDate = String(form.get("issueDate") || "");
    const isCurrent = form.get("isCurrent") === "true";
    if (!(file instanceof File) || (locale !== "zh" && locale !== "en")) {
      return NextResponse.json({ message: "海报文件无效" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ message: "海报需小于 12MB" }, { status: 413 });
    }

    const name = resolvePosterName(slug);
    const input = Buffer.from(await file.arrayBuffer());
    const original = input;
    const originalType = imageContentType(original);
    const version = posterVersion(original);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      return NextResponse.json({ message: "刊期日期无效" }, { status: 400 });
    }
    const archiveOriginal = `archive/${issueDate}/posters/${locale}/${name}.png`;
    const warnings: string[] = [];

    if (isCurrent) {
      await Promise.all([
        writeGitHubAsset(`public/posters/${locale}/${name}.png`, original, `Update ${locale} poster ${name}`),
        writeGitHubAsset(`public/${archiveOriginal}`, original, `Archive ${locale} poster ${issueDate} ${name}`),
      ]);
      await Promise.all([
        tryCos(() => uploadToCos(`posters/${locale}/${name}.png`, original, originalType, "no-store, max-age=0"), warnings),
      ]);
      await Promise.all([
        tryCos(() => copyCosObject(`posters/${locale}/${name}.png`, archiveOriginal), warnings),
      ]);
    } else {
      await Promise.all([
        writeGitHubAsset(`public/${archiveOriginal}`, original, `Update archive ${locale} poster ${issueDate} ${name}`),
      ]);
      await Promise.all([
        tryCos(() => uploadToCos(archiveOriginal, original, originalType, "no-store, max-age=0"), warnings),
      ]);
    }
    return NextResponse.json({
      ok: warnings.length === 0,
      partial: warnings.length > 0,
      version,
      contentType: originalType,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "海报上传失败" },
      { status: 500 },
    );
  }
}
