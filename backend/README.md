# ITSM backend

The server side of ITSM: tickets (`/api/v1/itsm/**`), SLA and business rules, incoming mail that becomes tickets, ticket mail
notifications and the Setup settings (`/api/v1/setup/settings/**`).

It is **not** a separate server. The DEX backend (`dex` repository) checks this repository out as the git submodule `itsm/` and
compiles `backend/src/main/java` into the same application, so ITSM keeps the same database, sign-in, roles and transactions, and the
console's features that open tickets (AI escalation, fleet alerts, field triggers) keep calling it directly.

* The packages stay `com.dex.*`, so nothing else had to change.
* The database tables and their Flyway migrations stay in the `dex` repository (one schema, one migration history).
* Mail sending (server settings, addresses, mailbox, password-reset mail) is shared and stays in `dex`.

## Working on it

```
# in the dex repository
git submodule update --init          # first time
cd itsm && git checkout main && git pull   # work here, commit and push to the itsm repository
cd .. && git add itsm && git commit -m "itsm: <what changed>"   # pin the new ITSM version in dex
cd backend && ./mvnw test           # builds the backend with this ITSM code
```

Tests for this code are in `backend/src/test/java` and run with the DEX backend's tests.
