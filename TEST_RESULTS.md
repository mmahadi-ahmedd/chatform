# Test results

Run on 2026-10-27 against PostgreSQL (local) and a production build.

## Unit tests (`npm test`)
```
 ✓ tests/unit/security.test.ts (9 tests) 16ms
 ✓ tests/unit/formschema.test.ts (12 tests) 14ms
 ✓ tests/unit/validate.test.ts (10 tests) 7ms
 ✓ tests/unit/logic.test.ts (5 tests) 4ms
 ✓ tests/unit/csv.test.ts (3 tests) 4ms
 Test Files  5 passed (5)
      Tests  39 passed (39)
```

## Integration tests (`npm run test:integration`)
```
 ✓ tests/integration/forms.test.ts (15 tests) 6990ms
 ✓ tests/integration/security.test.ts (9 tests) 7076ms
 ✓ tests/integration/auth.test.ts (12 tests) 10420ms
 ✓ tests/integration/integrations.test.ts (5 tests) 2633ms
 ✓ tests/integration/analytics.test.ts (5 tests) 2152ms
 ✓ tests/integration/embed.test.ts (2 tests) 952ms
 ✓ tests/integration/admin.test.ts (1 test) 1352ms
 Test Files  7 passed (7)
      Tests  49 passed (49)
```

Result: 88 / 88 passing. Covers cross-user access (all form/response/analytics/export/integration/upload/preset endpoints return 404 to other users and 401 to anonymous), admin RBAC, rate limiting, CSRF, validation and webhook signing.
