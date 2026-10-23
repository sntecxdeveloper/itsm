# Deploying the ITSM app

1. `npm ci && npm run build`
2. Copy `dist/` to the server and swap it in (keep the old one as `dist.bak-<time>`):

   ```
   /opt/dex_itsm_frontend/dist
   ```
3. nginx: the two locations in `dex-itsm.nginx.conf` go in the console's `server { }` block (once).
   `sudo nginx -t && sudo systemctl reload nginx`
4. Nothing else changes: the backend, the database and the console keep running as before. Each app has its own folder, so deploying
   one never overwrites the other.
