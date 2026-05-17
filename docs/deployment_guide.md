# Guide de Déploiement — Google Cloud Run & Secret Manager (Phase 5)

Ce guide décrit la procédure pas à pas pour déployer l'architecture de microservices OpsMind (API backend & Next.js dashboard) sur **Google Cloud Run** en sécurisant les clés d'API (Gemini, MongoDB, GitLab, Voyage AI) dans **Google Cloud Secret Manager**.

---

## 🛠️ 1. Prérequis & Initialisation

Avant de commencer, assurez-vous d'avoir :
1. Installé le [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install).
2. Connecté votre compte Google Cloud :
   ```bash
   gcloud auth login
   gcloud auth configure-docker
   ```
3. Défini votre ID de projet Google Cloud :
   ```bash
   export PROJECT_ID="votre-id-projet-google-cloud"
   gcloud config set project $PROJECT_ID
   ```
4. Activé les API nécessaires sur votre projet GCP :
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com
   ```

---

## 🔒 2. Sécurisation des Secrets avec Google Cloud Secret Manager

Conformément aux exigences de sécurité de la **Phase 4 & 5**, n'injectez jamais de clés d'API en clair dans vos conteneurs. Utilisez Secret Manager.

Créez les secrets suivants dans Secret Manager :

```bash
# 1. Clé d'API Google Gemini
echo -n "votre-gemini-api-key" | gcloud secrets create GEMINI_API_KEY --data-file=-

# 2. URI de connexion MongoDB Atlas (Primary Track)
echo -n "mongodb+srv://..." | gcloud secrets create MONGODB_URI --data-file=-

# 3. Jeton d'API GitLab (Remediation Partner)
echo -n "votre-gitlab-token" | gcloud secrets create GITLAB_TOKEN --data-file=-

# 4. Clé d'API Voyage AI (Reranking sémantique)
echo -n "votre-voyage-api-key" | gcloud secrets create VOYAGE_API_KEY --data-file=-
```

---

## 🐳 3. Création du Registre & Envoi des Images (Artifact Registry)

Créez un dépôt Docker sécurisé dans Google Artifact Registry :

```bash
# Créer le dépôt d'images docker
gcloud artifacts repositories create opsmind-docker \
  --repository-format=docker \
  --location=us-central1 \
  --description="OpsMind Production Docker Images"
```

### A. Compiler et pousser l'image API (Backend)
```bash
# Compiler l'image localement pour l'architecture cible Cloud Run
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-api:latest -f apps/api/Dockerfile .

# Pousser l'image vers Google Cloud
docker push us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-api:latest
```

### B. Compiler et pousser l'image Web Next.js (Frontend)
```bash
# Compiler l'image Web en injectant l'URL publique de l'API (une fois l'API déployée, cf. étape suivante)
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL="https://opsmind-api-xxxxxx-uc.a.run.app" \
  -t us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-web:latest \
  -f apps/web/Dockerfile .

# Pousser l'image vers Google Cloud
docker push us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-web:latest
```

---

## 🚀 4. Déploiement sur Google Cloud Run

Déployez vos microservices de manière hautement évolutive.

### Étape 4.1 : Déploiement de l'API backend
Déployez l'image API en liant les secrets créés à l'étape 2 sous forme de variables d'environnement injectées dynamiquement par GCP :

```bash
gcloud run deploy opsmind-api \
  --image=us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-api:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --update-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest,MONGODB_URI=MONGODB_URI:latest,GITLAB_TOKEN=GITLAB_TOKEN:latest,VOYAGE_API_KEY=VOYAGE_API_KEY:latest
```
*(Récupérez l'URL publique fournie par Cloud Run pour l'API backend et utilisez-la pour compiler l'image Web Next.js).*

### Étape 4.2 : Déploiement du Client Web Dashboard
Déployez l'image frontend :

```bash
gcloud run deploy opsmind-web \
  --image=us-central1-docker.pkg.dev/$PROJECT_ID/opsmind-docker/opsmind-web:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000
```

---

## 🧪 5. Validation de l'environnement conteneurisé en local

Vous pouvez tester l'exactitude de notre configuration multi-conteneurs localement sans installer Google Cloud CLI grâce à Docker Compose :

```bash
# Démarrer les services conteneurisés API + Web localement
docker compose up --build
```
L'API démarrera sur `http://localhost:8080` et la console Next.js sur `http://localhost:3000` ! Ils utiliseront les clés spécifiées dans votre fichier local `.env`.
