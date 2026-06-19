import { loadContentIssueFiles } from "./content/issues";

console.log(JSON.stringify({
  message: "content:compare requires Phase 3C repositories and will be enabled in that phase",
  jsonIssues: (await loadContentIssueFiles()).length,
}, null, 2));
