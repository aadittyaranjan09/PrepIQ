# GitHub Actions — CI/CD Setup Guide (One Render Web Service)

## Workflow Overview

```
Push to branch     → CI (Frontend build check + Backend syntax check + test suite)
Push to main       → CI + Automatic Deploy to ONE Render Web Service
```

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | Every push & PR | Installs deps, builds frontend, validates syntax, runs test suite |
| `.github/workflows/deploy-backend.yml` | Push to `main` | Optional: Triggers Render Deploy Hook (or let Render auto-deploy) |

---

## Render Deployment Options

### Option A: Render Auto-Deploy (Recommended & Easiest)
When connecting your GitHub repo to Render:
- Render automatically detects pushes to `main` branch.
- Render automatically pulls changes, runs `npm install && npm run build`, and restarts `npm start`.
- No GitHub Actions deploy secrets needed!

### Option B: Deploy Hook via GitHub Actions
If you prefer triggering deployments strictly via GitHub Actions:
1. Go to your Render Dashboard → Service → **Settings**.
2. Scroll to **Deploy Hook** → Click **Create Deploy Hook**.
3. Copy the generated URL.
4. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
5. Add secret name `RENDER_DEPLOY_HOOK_URL` with the URL as its value.
