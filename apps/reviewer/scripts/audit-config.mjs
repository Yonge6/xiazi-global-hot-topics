const forbiddenPublicNames = [
  "NEXT_PUBLIC_REVIEW_BEARER_SECRET",
  "NEXT_PUBLIC_REVIEW_HMAC_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_REPLAY_STORE_TOKEN",
];

const configured = forbiddenPublicNames.filter((name) => process.env[name]);
if (configured.length) {
  console.error(`Reviewer secrets must remain server-only: ${configured.join(", ")}`);
  process.exit(1);
}

console.log("Reviewer configuration audit passed.");
