# Shine Notes design

Build the Notes App described in the Cohort 10 candidate portal. Users register, sign in, sign out, and manage private rich text notes. The dashboard includes the current user's name, note list, search, and editor. Save and cancel are explicit; errors preserve unsaved work.

Use TypeScript, React, Express, PostgreSQL, Pino, backend Mocha/Chai, frontend Jest, and SonarQube. The portal permits PostgreSQL despite also listing MySQL. TypeScript addresses the upstream CodeRabbit rule. A small npm workspace keeps frontend and API commands together. Compared with MongoDB, PostgreSQL directly matches the detailed database requirement. Compared with a full Next.js app, Express keeps the required controllers, services, and data access layers easy to test.

Authentication uses random opaque session cookies, stored as hashes in PostgreSQL. Cookies are HttpOnly and SameSite=Lax; production requires HTTPS and Secure cookies. State-changing requests require the configured same-origin Origin header. Passwords use Node scrypt. SQL queries are parameterized and note writes include the authenticated user ID. The server allowlists rich text markup and never logs credentials, cookies, or note contents.

Notes support bold, italic, headings, lists, and undo/redo through Tiptap. Search is optional scope included after core CRUD. Real-time updates and import/export are deferred. No external deployment, paid services, or mentor identity will be invented.

Tests cover session expiry and revocation, cross-user access, invalid input, HTML sanitization, database failures, and frontend save/cancel/error behavior. Database tests execute the production SQL against embedded PostgreSQL using PGlite; a real TCP PostgreSQL smoke test is a separate check when available. CI runs types, build, tests, and coverage. SonarQube is configured locally; a successful remote scan must not be claimed without a running server.

The portal deadline is January 11, 2027 at 11:59 PM; its time zone is unconfirmed. Submission requires a PR to the original repository and resolution of HIGH/CRITICAL CodeRabbit findings before mentor review.
