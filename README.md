# DEX ITSM (tickets and Setup)

The ITSM part of the DEX console, as its own app and repository. It runs **next to** the console (`dex_frontend`) on the same site and
uses the same backend and the same sign-in, so every address stays as it was: `/tickets/...` and `/setup/...`.

## How the two apps fit together

| Address | App |
| --- | --- |
| `/tickets/**`, `/setup/**` | this app (served from `/opt/dex_itsm_frontend/dist`) |
| everything else (`/dashboard`, `/devices`, `/login`, ...) | the console (`/opt/dex_frontend/frontend/dist`) |
| `/itsm-static/**` | this app's files (the console owns `/assets`) |
| `/api/**`, `/ws/**` | the backend (unchanged) |

* Sign-in is the console's httpOnly cookie. Both apps are on one origin, so the cookie reaches both and the ITSM app asks
  `/api/v1/auth/me` like the console does. A person who is not signed in is sent to `/login` (the console).
* A link from one app to a page of the other is a normal page load (see `src/routes/LeaveToConsole.tsx` here and
  `HandOffToItsm.tsx` in the console), and the server hands out the right app for that address.
* Roles, pages hidden from a role and ITSM Setup sections keep working: they come from the backend (`/api/v1/access/me`).

## Develop

```
npm ci
npm run dev        # http://localhost:5174 - the API is proxied to localhost:8080
npm test
npm run build      # dist/ (assets under /itsm-static/)
```

In development open `http://localhost:5174/itsm-static/tickets`... or simply run the console as well and use its address; for a
quick check of a page, `npm run preview` after a build serves the same files the server does.

## Deploy

See `deploy/README.md`.
