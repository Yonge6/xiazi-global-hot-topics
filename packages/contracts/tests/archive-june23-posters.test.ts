import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseIssue} from '../src/schemas';

describe('authorized June 23 English poster restoration',()=>{
  it('publishes a complete immutable bilingual archive without changing the current issue',()=>{
    const issue=parseIssue(JSON.parse(readFileSync(new URL('../../../data/archive/2026-06-23.json',import.meta.url),'utf8')));
    const manifest=JSON.parse(readFileSync(new URL('../../../data/release-archive/2026-06-23.json',import.meta.url),'utf8'));
    expect(manifest.schemaVersion).toBe('xiazi-current-release-v1');
    expect(manifest.issueDate).toBe('2026-06-23');
    expect(manifest.releaseId).toBe(issue.assetVersion);
    expect(manifest.releaseId).toMatch(/^rel_20260623_[0-9a-f]{24}$/);
    expect(manifest.posters).toHaveLength(18);
    expect(new Set(manifest.posters.map((p:any)=>`${p.topicId}:${p.locale}`)).size).toBe(18);
    for(const t of issue.topics)for(const locale of ['zh','en']){
      const p=manifest.posters.find((p:any)=>p.topicId===t.id&&p.locale===locale);
      expect(p).toBeDefined();
      expect(p.contentHash).toMatch(/^[0-9a-f]{64}$/);
      const url=new URL(p.url);
      expect(url.origin).toBe('https://xiazi-release-assets-20260824.oss-cn-wulanchabu.aliyuncs.com');
      expect(url.pathname).toContain(manifest.assetBatchId);
      expect(url.pathname).toContain(`/${locale}/`);
      expect(url.pathname).toContain(t.slug);
    }
    const bundle=JSON.parse(readFileSync(new URL(`../../../data/releases/${manifest.releaseId}.json`,import.meta.url),'utf8'));
    expect(bundle.issue).toEqual(issue);
    expect(bundle.manifest).toEqual(manifest);
    const current=JSON.parse(readFileSync(new URL('../../../data/current-issue.json',import.meta.url),'utf8'));
    expect(current.issueDate).not.toBe('2026-06-23');
  });
});
