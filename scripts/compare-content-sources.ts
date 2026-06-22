import { JsonContentRepository } from "../apps/web/src/server/repositories/json-content-repository";
import { SupabaseContentRepository } from "../apps/web/src/server/repositories/supabase-content-repository";
import { compareContentRepositories } from "../apps/web/src/server/shadow/content-parity";
import { createServiceRoleClient } from "./content/env";

async function main() {
  const jsonRepository = new JsonContentRepository();
  const supabaseRepository = new SupabaseContentRepository(createServiceRoleClient());
  const result = await compareContentRepositories(jsonRepository, supabaseRepository);
  const differences = result.differences.map((difference) => difference.message);

  console.log(JSON.stringify({
    jsonIssues: result.jsonIssues,
    supabaseIssues: result.supabaseIssues,
    differences,
    differencePaths: result.differences.map((difference) => ({
      issueDate: difference.issueDate,
      path: difference.path,
    })),
  }, null, 2));
  process.exitCode = differences.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
