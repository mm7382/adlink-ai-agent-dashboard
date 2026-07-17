# ADLINK AI Agent Dashboard

Static GitHub Pages build for ADLINK AI Agent Engineering Program Dashboard.

## Shared Editing

The GitHub Pages dashboard reads and writes project data through the Cloudflare Worker API:

- API: `https://adlink-dashboard-api.cl3kx7.workers.dev/api/projects`
- Storage: Cloudflare Workers KV binding `ADLINK_DASHBOARD_KV`
- Data key: `dashboard-projects`

GitHub Pages is static, so direct edits on the page are not saved back to GitHub. The Worker API is the source of truth for shared edits.

Writes require the Dashboard management token. The token is stored locally in `dashboard-admin-token.txt`, which is ignored by Git.

Useful commands:

```bash
npx wrangler deploy
npx wrangler kv key put dashboard-projects --path adlink-dashboard-data.json --binding ADLINK_DASHBOARD_KV --remote
```
