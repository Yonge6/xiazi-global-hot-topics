export type ImmutableAssetLocale = "zh" | "en";

export type ImmutableAssetObjectProof = {
  assetBatchId: string;
  topicId: string;
  locale: ImmutableAssetLocale;
  issueDate: string;
  expectedNumber: number;
  expectedSite: "xiazishuo.com";
  key: string;
  url: string;
  sha256: string;
  contentType: "image/png";
  sizeBytes: number;
  createdAt: string;
  uploaderVersion: string;
  storageVersionId: string;
  etag: string;
  serverSideEncryption: "AES256";
};

export type StorageVerificationReport = {
  provider: "tencent-cos";
  policyVersion: string;
  assetBatchId: string;
  objectManifestHash: string;
  objects: ImmutableAssetObjectProof[];
  verifiedAt: string;
  verificationToolVersion: string;
  overwriteDenied: boolean;
  deleteDenied: boolean;
  policyVerified: boolean;
};
