# Kubernetes Deployment Guide

This document explains every manifest in `k8s/`, how they connect, and how to deploy to Minikube from scratch.

---

## Core Concepts (read this first)

Before diving into files, understand these four building blocks:

### Pod
The smallest deployable unit. A Pod is one or more containers that share a network and storage. You almost never create Pods directly — Deployments create and manage them.

### Deployment
A Deployment says "I want N copies of this Pod running, always." If a Pod crashes, the Deployment controller notices the actual count is lower than desired and creates a new one. This is self-healing.

### Service
Pods get random IPs that change on every restart. A Service gives a stable DNS name and load-balances traffic across all matching Pods. Other Pods use the Service name as a hostname (e.g., `postgres-service`).

### ConfigMap / Secret
Instead of baking config values into the container image, you inject them at runtime as environment variables. ConfigMap is for non-sensitive config. Secret is for passwords and API keys (stored base64-encoded, should be encrypted at rest in production).

---

## Manifest Walkthrough

### `namespace.yaml` — Isolation

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: standupsync
```

A namespace is like a folder inside the cluster. All StandupSync resources go in the `standupsync` namespace. Benefits:
- Easy cleanup: `kubectl delete namespace standupsync` removes everything at once
- Prevents naming collisions with other apps in the cluster
- Access control can be scoped per-namespace

**Apply first — everything else goes into this namespace.**

---

### `configmap.yaml` — Non-Sensitive Config

```yaml
data:
  POSTGRES_SERVER: "postgres-service"   # Kubernetes Service name, not localhost
  POSTGRES_PORT: "5432"
  POSTGRES_USER: "postgres"
  POSTGRES_DB: "standupsync"
  CELERY_BROKER_URL: "redis://redis-service:6379/0"
  FRONTEND_ORIGINS: "http://standupsync.local,http://localhost:5173"
```

**Key insight**: Services communicate using Service names as hostnames. The backend doesn't connect to `localhost:5432` — it connects to `postgres-service:5432`. Kubernetes DNS resolves `postgres-service` to the Service's ClusterIP automatically.

Notice `DATABASE_URL` is absent. It would require embedding the password in plaintext. Instead the app builds the URI from individual vars, with `POSTGRES_PASSWORD` injected separately from the Secret.

---

### `secret.yaml` — Sensitive Values

```yaml
data:
  POSTGRES_PASSWORD: cG9zdGdyZXM=     # base64("postgres")
  SECRET_KEY: Y2hhbmdlLW1lLWluLXByb2Q=
  GEMINI_API_KEY: eW91ci1rZXktaGVyZQ==
```

Base64 is NOT encryption — anyone can decode it with `base64 -d`. Secrets are just a Kubernetes convention that:
- Prevents values from showing in `kubectl get configmap`
- Allows fine-grained RBAC (you can give a Pod access to one Secret but not others)
- Is the foundation for real encryption (enable `EncryptionConfiguration` in prod, or use Vault)

**Generate real base64 values:**
```bash
echo -n "your-actual-password" | base64
```

**Never commit real secrets to Git.** For production, use:
- Kubernetes `EncryptionConfiguration` for at-rest encryption
- HashiCorp Vault or AWS Secrets Manager
- Sealed Secrets (encrypted CRDs you can safely commit)

---

### `postgres-pvc.yaml` — Persistent Storage

```yaml
kind: PersistentVolumeClaim
spec:
  accessModes:
    - ReadWriteOnce   # one Pod at a time can mount this
  resources:
    requests:
      storage: 1Gi
```

Without this, PostgreSQL data lives inside the container's filesystem. When the Pod restarts (which K8s does routinely — rollouts, node failures, OOM kills) all data is permanently lost.

A PVC requests a "virtual hard drive" from the cluster. In Minikube it uses your laptop's disk. In cloud providers (AWS, GCP) it automatically provisions an EBS Volume or Persistent Disk.

The PVC is referenced in the Postgres Deployment:
```yaml
volumes:
  - name: postgres-storage
    persistentVolumeClaim:
      claimName: postgres-pvc
```

---

### `postgres-deployment.yaml` + `postgres-service.yaml`

The Deployment runs `postgres:15-alpine` with the PVC mounted at `/var/lib/postgresql/data` (where Postgres stores its data files).

The Service makes Postgres reachable at `postgres-service:5432` from any other Pod in the namespace.

**Resource requests and limits** — explained:
```yaml
resources:
  requests:            # Guaranteed minimum — scheduler won't place Pod on node with less
    cpu: "250m"        # 250 millicores = 1/4 of one CPU core
    memory: "256Mi"
  limits:              # Hard maximum — container is killed (OOMKilled) if it exceeds this
    cpu: "500m"
    memory: "512Mi"
```

---

### `backend-deployment.yaml` — The Most Complex Manifest

```yaml
spec:
  replicas: 2   # Two backend Pods for high availability
  template:
    spec:
      initContainers:
        - name: migrate
          command: ["uv", "run", "alembic", "upgrade", "head"]
```

**initContainers** run to completion before the main container starts. The `migrate` init container runs Alembic migrations on every deployment. This guarantees:
- Schema is always up to date before the app starts serving traffic
- Zero manual migration steps during deploys
- If migration fails (exit non-zero), the Pod never starts and Kubernetes rolls back

**Readiness and Liveness probes:**
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10   # wait 10s before first check (app startup time)
  periodSeconds: 10          # check every 10s
  failureThreshold: 3        # 3 failures = mark unready

livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30   # longer — let it fully start before killing it
  periodSeconds: 20
  failureThreshold: 3
```

- **Readiness probe**: If it fails, the Pod is removed from the Service's load balancer. Traffic stops going to it. Once it passes again, traffic resumes. Zero-downtime deployments work because the new Pod is only added to rotation after its readiness probe passes.
- **Liveness probe**: If it fails, Kubernetes kills and restarts the Pod. Recovers from deadlocks or infinite loops.

---

### `worker-deployment.yaml` + `beat-deployment.yaml`

Both use the same Docker image as the backend but with a different `command`:

```yaml
# worker
command: ["uv", "run", "celery", "-A", "app.celery_app", "worker", "--loglevel=info"]

# beat
command: ["uv", "run", "celery", "-A", "app.celery_app", "beat", "--loglevel=info"]
```

**Why the Worker has no Service**: Workers pull tasks from Redis — they never receive inbound HTTP traffic. No Service needed.

**Beat MUST have `replicas: 1`**: Two Beat instances each schedule tasks independently. The weekly digest would fire twice, sending duplicate emails and writing duplicate DB rows. Always keep Beat at 1 replica.

---

### `frontend-nginx-configmap.yaml` — SPA Routing Fix

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

This one-liner solves a common React Router problem. When you navigate to `/admin` in React, React Router handles it client-side — no request goes to the server. But if you **refresh** at `/admin`, Nginx receives a request for `/admin`, looks for a file, finds nothing, and returns `404`.

The fix: Nginx first looks for a real file (`$uri`), then a directory (`$uri/`), then falls back to `index.html`. React loads, reads the URL from the browser, and renders the correct view.

---

### `ingress.yaml` — The Entry Point

```yaml
rules:
  - host: standupsync.local
    http:
      paths:
        - path: /api      # → backend-service:8000
        - path: /health   # → backend-service:8000
        - path: /         # → frontend-service:80  (catch-all)
```

The Ingress is the cluster's "front door." One public IP (the Ingress controller's) routes traffic to the right Service based on the path.

**No `rewrite-target` annotation** — this is intentional. With rewrite-target, `/api/v1/auth/login` would arrive at the backend as `/v1/auth/login` (the `/api` prefix is stripped). Our backend routes start with `/api/v1/...` so the full path must be forwarded unchanged.

---

### `argocd-app.yaml` — GitOps Controller

```yaml
spec:
  source:
    repoURL: https://github.com/abynxv/standupsync.ai.git
    path: k8s         # watches the k8s/ directory
  syncPolicy:
    automated:
      prune: true       # delete resources removed from Git
      selfHeal: true    # revert manual kubectl changes
```

ArgoCD continuously compares the `k8s/` folder in your Git repo against what's actually running in the cluster. When they differ, it syncs.

`selfHeal: true` means if you manually run `kubectl edit deployment backend` and change something, ArgoCD will revert it within minutes. **Git is the source of truth** — you cannot make lasting changes outside of Git.

---

## Deploying to Minikube

### Step 1 — Start Minikube

```bash
minikube start --cpus=4 --memory=6g
minikube addons enable ingress
```

### Step 2 — Load Images (skip registry, use local build)

```bash
# Build locally
docker build -t abynxv/standupsync-backend:latest ./backend
docker build -t abynxv/standupsync-frontend:latest ./frontend

# Load directly into Minikube's Docker daemon (no push needed)
minikube image load abynxv/standupsync-backend:latest
minikube image load abynxv/standupsync-frontend:latest
```

### Step 3 — Update Secrets with Real Values

```bash
# Encode your actual values
echo -n "your-real-postgres-password" | base64
echo -n "your-real-secret-key" | base64
echo -n "your-real-gemini-api-key" | base64
```

Replace the placeholder base64 values in `k8s/secret.yaml`.

### Step 4 — Apply Manifests

```bash
# Apply in dependency order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/frontend-nginx-configmap.yaml

# Storage + databases first
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml

# App services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/beat-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Ingress last
kubectl apply -f k8s/ingress.yaml
```

Or apply everything at once (Kubernetes handles dependency order):
```bash
kubectl apply -f k8s/
```

### Step 5 — Add /etc/hosts Entry

```bash
echo "$(minikube ip) standupsync.local" | sudo tee -a /etc/hosts
```

### Step 6 — Verify Everything is Running

```bash
# Watch pods come up (Ctrl+C when all show Running)
kubectl get pods -n standupsync -w

# Check all resources
kubectl get all -n standupsync
```

### Step 7 — Access the App

```bash
# Open the app (uses the /etc/hosts entry)
open http://standupsync.local

# Or get the direct URL via NodePort
minikube service frontend-service -n standupsync --url
minikube service backend-service -n standupsync --url
```

---

## Useful kubectl Commands

```bash
# See all resources in the namespace
kubectl get all -n standupsync

# Check pod logs (follow with -f)
kubectl logs -f deployment/backend -n standupsync
kubectl logs -f deployment/worker -n standupsync
kubectl logs -f deployment/beat -n standupsync

# Describe a pod (shows events, env vars, probe results)
kubectl describe pod <pod-name> -n standupsync

# Execute a command inside a running container
kubectl exec -it deployment/backend -n standupsync -- bash

# Scale the backend (zero-downtime rolling update)
kubectl scale deployment/backend --replicas=3 -n standupsync

# See rollout history
kubectl rollout history deployment/backend -n standupsync

# Roll back to previous version
kubectl rollout undo deployment/backend -n standupsync

# Delete everything and start fresh
kubectl delete namespace standupsync
```

---

## Promoting from Minikube to Production

| Concern | Minikube | Production |
|---|---|---|
| Image source | `minikube image load` | Docker Hub / ECR (pulled by kubelet) |
| Storage | Local disk (standard StorageClass) | EBS / Persistent Disk (auto-provisioned) |
| Ingress | Minikube addon | Cloud load balancer (AWS ALB / GCP LB) |
| Secrets | Plaintext base64 in YAML | HashiCorp Vault or KMS-encrypted |
| Database | In-cluster PostgreSQL Pod | Managed DB (RDS, Cloud SQL) |
| Redis | In-cluster Pod | Managed Redis (ElastiCache, Memorystore) |
| ArgoCD | Manual `kubectl apply` | ArgoCD watches Git, syncs automatically |
