import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {parseIssue} from '../src/schemas';

describe('June 23 historical archive compatibility',()=>{
  const file=new URL('../../../data/archive/2026-06-23.json',import.meta.url);
  it('loads all nine original topics under the current published issue contract',()=>{
    const issue=parseIssue(JSON.parse(readFileSync(file,'utf8')));
    expect(issue.issueDate).toBe('2026-06-23');
    expect(issue.status).toBe('published');
    expect(issue.topics).toHaveLength(9);
    expect(issue.topics[0].category).toBe('international');
    expect(issue.topics[0].sources[0].sourceType).toBe('publisher');
  });
  it('preserves every published field except the two invalid enum values',()=>{
    const issue=JSON.parse(readFileSync(file,'utf8'));
    delete issue.topics[0].category;
    delete issue.topics[0].sources[0].sourceType;
    expect(createHash('sha256').update(JSON.stringify(issue)).digest('hex'))
      .toBe('5cdcfe63e9c16f6a89e4dab9505a7f250c18fa700536210971bc0075027b94f4');
  });
  it('keeps the public data mirror identical and on the active domain',()=>{
    const mirror=new URL('../../../public/data/archive/2026-06-23.json',import.meta.url);
    expect(readFileSync(mirror,'utf8')).toBe(readFileSync(file,'utf8'));
  });
});
