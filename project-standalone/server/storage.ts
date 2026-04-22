// 로컬 파일 시스템 스토리지 (Manus S3 대체)
import fs from "fs";
import path from "path";
import { ENV } from "./_core/env";
import crypto from "crypto";

function getUploadDir(): string {
  const dir = path.resolve(ENV.uploadDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(getUploadDir(), key.replace(/\//g, "_"));

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, data);

  return { key, url: `/local-storage/${encodeURIComponent(key)}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/local-storage/${encodeURIComponent(key)}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  // 로컬에서는 서버의 파일 서빙 URL을 직접 반환
  const key = normalizeKey(relKey);
  return `/local-storage/${encodeURIComponent(key)}`;
}

export function getLocalFilePath(key: string): string {
  const decodedKey = decodeURIComponent(key);
  return path.join(getUploadDir(), decodedKey.replace(/\//g, "_"));
}
