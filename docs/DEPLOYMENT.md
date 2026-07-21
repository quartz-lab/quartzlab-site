# Deployment

## GitHub Pages workflow

`.github/workflows/pages.yml` builds on pushes and pull requests to `main`, manual dispatch, and the daily schedule. Pull requests build and validate without deploying. Other runs upload the clean `_site/` artifact and deploy it with the official GitHub Pages actions. The workflow never creates bot commits.

Production always uses:

```text
SITE_ORIGIN=https://quartzlab.ru
SITE_BASE_PATH=/
```

The base path reported by the Pages configuration action is intentionally not used for the custom domain. Validation fails if the project path `/quartzlab-site/` leaks into a production artifact.

## Manual deployment

Open **Actions → Build and deploy GitHub Pages → Run workflow**, select `main`, and run it. Confirm that both `build` and `deploy` succeed and that the `github-pages` environment points to `https://quartzlab.ru`.

## Repository and domain settings

In **Settings → Pages**, set the source to **GitHub Actions**, configure the custom domain as `quartzlab.ru`, wait for the DNS check and certificate, then enable **Enforce HTTPS**.

For the apex domain, use GitHub Pages' documented A/AAAA records. Point `www` to `quartz-lab.github.io` with a CNAME. Check the current record values against the official GitHub Pages custom-domain documentation before changing DNS; do not put the repository name in the CNAME target.

## Rollback

Use the Pages environment deployment history to identify the last known-good revision. Re-run the workflow for a corrected or reverted `main` revision; where GitHub offers redeployment for the retained artifact, redeploy that known-good deployment. Verify the root, both languages, a plugin page, documentation, and a missing route after rollback.
