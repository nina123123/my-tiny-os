# Publishing

The site deploys itself to GitHub Pages using `.github/workflows/deploy.yml`.

- **Every push to any branch** runs lint and build, as a safety check.
- **Only pushes to `main`** go live.

The live address is `https://<github-username>.github.io/<repo-name>/`. The build uses relative paths, so any repo name works.

## One-time setup (the person does this on GitHub)

1. Open the repo on GitHub, then go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

If `gh` is logged in on this machine, you can do it for them instead:

```bash
gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
```

If that returns "already exists", run the same command with `-X PUT` instead.

## Getting changes onto `main`

- **Working locally, on `main`:** commit, then `git push`. Done.
- **Claude Code on the web, or any branch other than `main`:** the site only updates after the branch is merged.
  1. Push the branch and open a pull request: use the **Create PR** button in Claude Code on the web, or `gh pr create`.
  2. Tell the person to open the pull request on GitHub and click **Merge pull request → Confirm merge**.

Explain this in one sentence the first time it comes up, because it's the most common "why didn't my site change?" moment.

After merging, the **Actions** tab shows a run called "Deploy my-tiny-os". A green ✓ (after 1–2 minutes) means the site is live. Have them open the link in a private/incognito window on their phone to check what visitors see.

## Guestbook with Supabase (optional)

Without keys, the guestbook runs in demo mode: notes stay on the visitor's own device. To make it shared, follow `docs/GUESTBOOK.md`. In short:

1. They create a free project at supabase.com.
2. They run `supabase/guestbook.sql` in the SQL editor.
3. They give you two values: the **Project URL** and the **publishable key** (it starts with `sb_publishable_`).
4. You put them in `.env.production`, or they add them as repo **Variables** under Settings → Secrets and variables → Actions → Variables.

Tell them clearly: the publishable key is meant to be public. **Never** paste the `service_role` / secret key or the database password into the chat or the repo. If they paste one by accident, tell them to rotate it in Supabase right away, and don't use it.

## Common problems

| What they see | Fix |
| --- | --- |
| Red ✗ in Actions | Open the failed step. Lint and build errors name the file and line. Run `npm run lint && npm run build` locally, fix, then push again. The live site keeps its last good version. |
| "Branch … is not allowed to deploy to github-pages" | Settings → Environments → github-pages → Deployment branches: allow `main`. |
| 404 right after the first deploy | Wait 1–2 minutes and refresh. Also check that Pages Source is set to GitHub Actions. |
| Old version still showing | GitHub Pages caches for a few minutes. Hard-refresh (Cmd/Ctrl + Shift + R) or use a private window. |
| Photos missing on the live site but fine locally | File name case doesn't match (`Photo.WEBP` vs `photo.webp`); GitHub Pages is case-sensitive. |
| Link preview shows the demo image | Replace `public/og.jpg` and update the meta tags in `index.html`. |

## Their own domain (optional)

They can buy something like `theirname.com` (about $10–12 a year), then:

1. Add the domain under Settings → Pages → Custom domain.
2. Follow GitHub's DNS instructions.
3. Add a `public/CNAME` file containing just the domain.
