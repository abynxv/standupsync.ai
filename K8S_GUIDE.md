# 🚀 Exploring your Kubernetes & ArgoCD Setup

This guide will walk you through exactly how your new infrastructure works. We will move from the Command Line (CLI) to the Graphical Interface (GUI) and finally perform a "GitOps" experiment.

---

## 1. The CLI Tour: Seeing the "Architecture"
Kubernetes resource names aren't just names; they describe the architecture.

### Check everything in your namespace
Run this command to see the entire stack:
```bash
kubectl get all -n standupsync
```
- **Pods**: These are the running instances of your app.
- **Services**: These are the "Load Balancers" that give your pods a stable address.
- **Deployments**: The "Boss" that ensures if a pod dies, a new one is born.

### Inspect a single Pod
Pick a backend pod name from the list above and run:
```bash
kubectl describe pod <pod_name> -n standupsync
```
**What to look for:**
- **Events**: At the bottom, you'll see "Pulling image", "Created", "Started". This is the history of that specific container.
- **Environment Variables**: See how the ConfigMap and Secrets are injected.

---

## 2. The GitOps Workflow: Seeing ArgoCD in Action
ArgoCD is currently running inside your cluster, but it needs to "see" your code on GitHub to work.

### Step A: Push your code
For ArgoCD to work, your local `k8s/` folder **must** be on GitHub.
```bash
git add k8s/
git commit -m "feat: add kubernetes manifests and argocd config"
git push origin main
```

### Step B: Access the ArgoCD Dashboard
1. **Login**:
   - URL: [https://localhost:8080](https://localhost:8080) (accept the certificate warning)
   - Username: `admin`
   - Password: `siFRHL34jBdR2uWW`
2. **Setup Port Forwarding**:
   Run this in a separate terminal and keep it open:
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   ```

### Step C: Create the App in ArgoCD (The Glue)
Apply the "Application" definition I created for you:
```bash
kubectl apply -f k8s/argocd-app.yaml
```
Now, look at the ArgoCD dashboard. You will see a "Tree" diagram of your app. It is currently comparing your GitHub code to your Minikube cluster.

---

## 3. The "Backend Engineer" Experiment
Let's see why this setup is so powerful. We are going to scale your backend horizontally without writing any code.

1. **Modify the file**: Open `k8s/backend-deployment.yaml`.
2. **Change the replicas**: Find `replicas: 1` and change it to `replicas: 2`.
3. **Commit and Push**:
   ```bash
   git add k8s/backend-deployment.yaml
   git commit -m "ops: scale backend to 2 replicas"
   git push origin main
   ```
4. **Watch ArgoCD**: Within 3 minutes (or click "Refresh" in the UI), ArgoCD will notice GitHub says "2" but Minikube has "1". It will automatically trigger a sync and you will see a second backend pod appear in the UI.

---

## 🛠 Troubleshooting Cheat Sheet

| Situation | Command |
| :--- | :--- |
| **App is crashing?** | `kubectl logs <pod_name> -n standupsync` |
| **Service URL?** | `minikube service frontend-service -n standupsync --url` |
| **Cluster is full?** | `minikube ssh -- docker system prune -af` |
| **Start fresh?** | `kubectl delete namespace standupsync` |

---

## Why did we do it this way?
- **Namespace (`standupsync`)**: So you don't mix your databases with system tools.
- **Services**: So your Frontend can find the Backend using the name `backend-service` instead of a random IP address.
- **Secrets**: So your API keys (Gemini) are never visible in plain text in your code.
