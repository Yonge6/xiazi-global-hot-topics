1. This is a gradual migration. Do not rewrite the product from scratch.
2. Data contracts belong in `packages/contracts`.
3. Shared business rules belong in `packages/domain`.
4. Web, Mini, and Mobile must not duplicate Issue, Topic, or User types.
5. API changes must update schema, client, and tests together.
6. Database changes must be new migrations, never edits to executed migrations.
7. Do not commit new binary poster assets.
8. Do not expose Service Role keys, COS secrets, WeChat AppSecret, or Authing secrets to clients.
9. Do not use email, WeChat OpenID, or Authing `sub` as a business primary key.
10. All user identities must resolve to an internal UUID.
11. Publishing operations must be auditable and reversible.
12. Production configuration must not rely on default secrets.
13. Each phase must run check, build, and relevant E2E verification.
14. Do not force shared UI across platforms for the sake of reuse.
15. Content, ordering, image URLs, and feature flags should be server driven.
