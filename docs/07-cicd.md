# CI/CD Pipeline & GitOps

This document explains the full journey from a `git push` to a running update in Kubernetes — automated, zero-touch.

---

## The Big Picture

```
Developer pushes code to main
          │
          ▼
  GitHub Actions starts
          │
  ┌───────┴──────────┐
  │  1. Run Tests    │  (backend-test job)
  └───────┬──────────┘
          │ tests pass
          ▼
  ┌────────────────────────────────────┐
  │  2. Build & Push Docker Images     │  (build-and-push job)
  │     Backend → Docker Hub           │
  │     Frontend → Docker Hub          │
  │     Both tagged: latest + SHA      │
  └───────────────┬────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────┐
  │  3. Update k8s/ manifests in Git   │
  │     backend-deployment.yaml        │
  │     worker-deployment.yaml         │
  │     beat-deployment.yaml           │
  │     frontend-deployment.yaml       │
  │     Commit: "ci: bump image tags"  │
  └───────────────┬────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────┐
  │  4. ArgoCD detects Git change      │
  │     Pulls new images from Hub      │
  │     Rolling update — zero downtime │
  └────────────────────────────────────┘
```

---

## Pipeline File: `.github/workflows/ci.yml`

### Triggers

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

- **Push to main**: runs both jobs (test → build+push)
- **Pull request to main**: runs only the test job (no image push — PR hasn't been reviewed yet)

### Permissions

```yaml
permissions:
  contents: write
```

The workflow needs write access so it can commit the updated k8s manifests back to the repo (Step 3). Without this, the `git push` in the last step would fail with a `403`.

---

## Job 1: `backend-test`

Runs on every push and PR. Starts a fresh Ubuntu VM, installs dependencies, and runs the test suite.

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Install uv
    uses: astral-sh/setup-uv@v3
    with:
      enable-cache: true   # caches uv's download cache between runs (faster)

  - name: Install dependencies
    run: cd backend && uv sync --frozen
    # --frozen: uses exact lockfile versions, never re-resolves

  - name: Run tests
    run: cd backend && uv run pytest
```

If any test fails → the job exits non-zero → the build-and-push job is skipped → no broken image is ever pushed to Docker Hub.

---

## Job 2: `build-and-push`

Only runs on direct pushes to `main` (not PRs). Depends on `backend-test` passing.

```yaml
needs: backend-test
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

### Step: Derive short SHA

```yaml
- name: Derive short SHA
  id: sha
  run: echo "short=$(echo ${{ github.sha }} | cut -c1-7)" >> $GITHUB_OUTPUT
```

`github.sha` is the full 40-character commit hash. We trim it to 7 characters (e.g., `a1b2c3d`) — enough to be unique, short enough to be readable in image tags and `kubectl describe`.

### Step: Build and Push with Layer Caching

```yaml
- name: Build and push Backend
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    push: true
    tags: |
      ${{ secrets.DOCKERHUB_USERNAME }}/standupsync-backend:latest
      ${{ secrets.DOCKERHUB_USERNAME }}/standupsync-backend:${{ steps.sha.outputs.short }}
    cache-from: type=registry,ref=.../standupsync-backend:latest
    cache-to: type=inline
```

**Two tags on every image:**

| Tag | Purpose |
|---|---|
| `latest` | Always points to the most recent build from main. Used as the cache source for the next build (if deps haven't changed, Docker reuses cached layers). |
| `a1b2c3d` (SHA) | Immutable. Points to exactly one commit forever. K8s manifests use this tag — you can always trace a running container back to the exact code that built it. |

**Why `latest` is risky in production but fine as cache:** If your K8s manifests say `image: .../backend:latest` and a node restarts and re-pulls, it might get a different image than what's currently running — depending on when the pull happens. The SHA tag eliminates this non-determinism. Every node always pulls the exact same bytes.

**Layer caching** (`cache-from`): Docker builds images layer by layer. If only the source code changed (not `pyproject.toml`), the `uv sync` layer is served from cache — the build skips dependency installation entirely. This cuts build time from ~2 minutes to ~20 seconds on cache hits.

### Step: Update k8s Image Tags (GitOps handoff)

```bash
SHORT=${{ steps.sha.outputs.short }}
HUB=${{ secrets.DOCKERHUB_USERNAME }}

sed -i "s|image: .*/standupsync-backend:.*|image: ${HUB}/standupsync-backend:${SHORT}|g" \
  k8s/backend-deployment.yaml \
  k8s/worker-deployment.yaml \
  k8s/beat-deployment.yaml
```

`sed -i` edits the YAML files in-place, replacing whatever SHA was there before with the new one. The pattern `.*` matches any existing tag (including `latest`).

### Step: Commit and Push

```bash
git config user.email "ci-bot@standupsync.com"
git config user.name "CI Bot"
git add k8s/backend-deployment.yaml k8s/worker-deployment.yaml \
        k8s/beat-deployment.yaml k8s/frontend-deployment.yaml

# Only commit if something changed (idempotent — avoids empty commits)
git diff --staged --quiet || \
  git commit -m "ci: bump image tags to ${{ steps.sha.outputs.short }} [skip ci]"
git push
```

`[skip ci]` in the commit message prevents an infinite loop — GitHub Actions recognizes this tag and doesn't trigger a new pipeline run for the manifest commit.

`git diff --staged --quiet` checks if there are staged changes. If no files changed (e.g., the SHA tag was already current), the `||` right side (commit) is skipped. This is the idempotency guard.

---

## ArgoCD: The GitOps Controller

### What ArgoCD does

ArgoCD runs inside the cluster. It watches the `k8s/` folder in your GitHub repo. Every ~3 minutes (or immediately on webhook), it compares:

- **Desired state** — what the YAML files in Git say
- **Actual state** — what's actually running in the cluster

When they differ, ArgoCD syncs — applying the changes to the cluster.

### The Application manifest (`k8s/argocd-app.yaml`)

```yaml
spec:
  source:
    repoURL: https://github.com/abynxv/standupsync.ai.git
    path: k8s                # ArgoCD watches only this directory
    targetRevision: HEAD     # always track the latest commit on main
  destination:
    namespace: standupsync
  syncPolicy:
    automated:
      prune: true       # if a resource is removed from Git, delete it from the cluster too
      selfHeal: true    # revert manual kubectl changes — Git is the source of truth
    syncOptions:
      - CreateNamespace=true  # create the namespace if it doesn't exist
```

### The deployment sequence after a git push

1. GitHub Actions commits updated image tags to `k8s/*.yaml`
2. ArgoCD detects a new commit to `k8s/`
3. ArgoCD runs `kubectl apply` on the changed manifests
4. Kubernetes starts a **rolling update** on the affected Deployments:
   - Spins up a new Pod with the new image
   - Waits for the new Pod's readiness probe to pass
   - Removes an old Pod
   - Repeats until all replicas are updated
5. Zero downtime — at least one healthy Pod is always serving traffic throughout

### Access the ArgoCD dashboard

```bash
# Port-forward the ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080 (accept the self-signed cert warning)
# Username: admin
# Password: kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
```

---

## Required Repository Secrets

Set these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value | How to get it |
|---|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | Hub profile page |
| `DOCKERHUB_TOKEN` | Docker Hub personal access token | Hub → Settings → Security → New Access Token |

**Use a token, not your password.** Tokens can be scoped (read/write only, no delete) and revoked individually without changing your password.

---

## Rolling Back a Bad Deploy

**Option 1 — Revert the Git commit (recommended)**

```bash
git revert HEAD          # creates a new commit that undoes the last one
git push origin main     # triggers CI → ArgoCD deploys the reverted state
```

ArgoCD picks up the revert commit and rolls back to the previous image tag. Full audit trail in Git.

**Option 2 — Manual kubectl rollback (emergency)**

```bash
# See rollout history
kubectl rollout history deployment/backend -n standupsync

# Roll back to the previous version immediately
kubectl rollout undo deployment/backend -n standupsync
```

Warning: this creates drift between Git and the cluster. ArgoCD's `selfHeal: true` will revert it back to the Git state within minutes. Use Option 1 for a lasting fix.

---

## Checklist: Adding a New Service to the Pipeline

Say you add a `notification-service`. Here's what you need to update:

1. **Dockerfile** — add `notification-service/Dockerfile`
2. **CI workflow** — add a build-and-push step for the new image
3. **Update k8s tags step** — add `sed` command for `k8s/notification-deployment.yaml`
4. **New manifests** — create `k8s/notification-deployment.yaml` and `k8s/notification-service.yaml`
5. **ConfigMap** — add any new env vars it needs
6. **Secret** — add any new sensitive values

ArgoCD will pick up the new manifests automatically on the next sync.
