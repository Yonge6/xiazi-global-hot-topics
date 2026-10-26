import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {parseIssue} from '@xiazi/contracts';
import {immutableAssetKey} from '@xiazi/domain';
import {OssImmutableAssetStore} from '../apps/web/src/server/storage/oss-immutable-asset-store';
import {createVerifiedImmutableObject} from '../apps/web/src/server/storage/immutable-asset-store';

async function main(){
const date='2026-06-23';
const base='/Volumes/DevSSD/Codex/diagnostics/xiazi-june23-poster-repair';
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const apply=process.argv.includes('--apply');
if(process.argv.slice(2).some(x=>!['--apply','--dry-run'].includes(x)))throw Error('UNSUPPORTED_ARGUMENT');
const issuePath=`data/archive/${date}.json`;
const original=JSON.parse(await readFile(issuePath,'utf8'));
const issue=parseIssue(original);
if(issue.issueDate!==date||issue.topics.length!==9)throw Error('ISSUE_SCOPE_MISMATCH');
const qa=JSON.parse(await readFile(`${base}/qa.json`,'utf8'));
if(qa.status!=='approved'||qa.posters.length!==9)throw Error('VISUAL_QA_REQUIRED');
const protectedFiles=['data/current-issue.json','data/current-release.json'];
const protectedHashes=await Promise.all(protectedFiles.map(async f=>sha(await readFile(f))));
const posters=[];
for(const topic of issue.topics){
  for(const locale of ['zh','en'] as const){
    const file=`${base}/${locale}/${topic.rank}-${topic.slug}.png`;
    const bytes=await readFile(file);
    const hash=sha(bytes);
    const meta=await sharp(bytes).metadata();
    if(meta.format!=='png'||!meta.width||!meta.height||meta.width<600||meta.height<1000||Math.abs(meta.height/meta.width-2)>0.01)throw Error(`IMAGE_INVALID:${locale}:${topic.rank}`);
    await sharp(bytes).stats();
    if(locale==='zh'){
      const canonical=execFileSync('git',['show',`HEAD:public/archive/${date}/posters/zh/${topic.slug}.png`],{maxBuffer:20000000});
      if(sha(canonical)!==hash)throw Error(`CHINESE_MASTER_CHANGED:${topic.rank}`);
    }else if(!qa.posters.some((q:{rank:number;sha256:string})=>q.rank===topic.rank&&q.sha256===hash))throw Error(`QA_HASH_MISMATCH:${topic.rank}`);
    posters.push({topicId:topic.id,rank:topic.rank,slot:topic.slug,locale,bytes,hash,width:meta.width,height:meta.height});
  }
}
const suffix=sha(posters.map(p=>`${p.topicId}:${p.locale}:${p.hash}`).join('\n')).slice(0,24);
const releaseId=`rel_20260623_${suffix}`;
const assetBatchId=`asset_archive_20260623_${suffix}`;
console.log(`PREFLIGHT date=${date} posters=${posters.length} chinese_unchanged=9 english_qa=9 release=${releaseId}`);
if(apply){
  const configFile=path.join(os.homedir(),'.config/xiazi/oss-publisher.json');
  const configStat=await stat(configFile);
  if((configStat.mode&0o777)!==0o600||configStat.uid!==process.getuid?.())throw Error('CONFIG_PERMISSIONS_INVALID');
  const store=new OssImmutableAssetStore(JSON.parse(await readFile(configFile,'utf8')));
  await store.verifyVersioning();
  const results=[];
  for(const p of posters){
    const result=await createVerifiedImmutableObject(store,{
      key:immutableAssetKey(assetBatchId,p.locale,p.slot),content:p.bytes,contentType:'image/png',assetBatchId,
      topicId:p.topicId,locale:p.locale,issueDate:date,expectedNumber:p.rank,expectedSite:'xiazishuo.com',
      createdAt:new Date().toISOString(),uploaderVersion:'xiazi-authorized-english-archive-restoration-20261026',
    });
    results.push(result.object);
    console.log(`VERIFIED ${results.length}/18 ${p.locale} NO.${p.rank}`);
  }
  const manifest={schemaVersion:'xiazi-current-release-v1',issueDate:date,releaseId,assetBatchId,
    posters:results.map(p=>({topicId:p.topicId,locale:p.locale,contentHash:p.sha256,url:p.url}))};
  const updated={...original,assetVersion:releaseId};
  for(const dir of ['data/release-archive','data/releases'])await mkdir(dir,{recursive:true});
  for(const f of [issuePath,`public/data/archive/${date}.json`])await writeFile(f,JSON.stringify(updated,null,2)+'\n');
  await writeFile(`data/release-archive/${date}.json`,JSON.stringify(manifest,null,2)+'\n');
  await writeFile(`data/releases/${releaseId}.json`,JSON.stringify({issue:updated,manifest},null,2)+'\n');
  await writeFile(`${base}/publication-proof.json`,JSON.stringify({date,releaseId,assetBatchId,restoredAt:new Date().toISOString(),provenance:'English images newly localized from original Chinese masters under explicit user request using signed-in ChatGPT web; not recovered originals',objects:results},null,2)+'\n');
  console.log(`ARCHIVE_READY ${releaseId}`);
}
for(let i=0;i<protectedFiles.length;i++)if(sha(await readFile(protectedFiles[i]))!==protectedHashes[i])throw Error('CURRENT_PUBLICATION_CHANGED');
console.log('CURRENT_PUBLICATION_UNCHANGED');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'RESTORATION_FAILED');process.exitCode=1;});
