# OpsMind — Deployment Guide

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- MongoDB (Atlas or local)
- Google Gemini API key

### Setup
```bash
# Clone and install
pnpm install

# Configure environment
cp .env .env.local
# Edit .env.local with your values

# Start API server (port 3001)
pnpm --filter @opsmind/api dev

# Start web dashboard (port 3000)
pnpm --filter @opsmind/web dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `MONGODB_DB_NAME` | — | Database name (default: `opsmind`) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | — | Model name (default: `gemini-2.5-pro`) |
| `GEMINI_TEMPERATURE` | — | Temperature (default: `0.2`) |
| `GOOGLE_CLOUD_PROJECT_ID` | — | For Agent Builder integration |
| `AGENT_MAX_STEPS` | — | Max tool execution steps (default: `10`) |
| `AGENT_REFLECTION_ENABLED` | — | Enable reflection loop (default: `true`) |
| `AGENT_CONFIDENCE_THRESHOLD` | — | Min confidence threshold (default: `0.7`) |
| `AGENT_MEMORY_RETRIEVAL_LIMIT` | — | Historical decisions per session (default: `5`) |
| `VECTOR_SEARCH_ENABLED` | — | Enable Atlas Vector Search (default: `false`) |

---

## Build

```bash
# Build all packages in dependency order
pnpm build

# Build specific package
pnpm --filter @opsmind/api build
pnpm --filter @opsmind/web build
```

Turborepo handles build ordering based on the dependency graph. `packages/shared` and `packages/config` build first, then `packages/memory`, `packages/tools`, `packages/ai`, `packages/agent`, then `apps/`.

---

## MongoDB Atlas Setup

### 1. Create cluster
- Free tier (M0) works for development and demo
- Recommended: M10+ for production

### 2. Create database user
- Username/password authentication
- Read/write access to `opsmind` database

### 3. Network access
- Add your IP address (or 0.0.0.0/0 for demo)

### 4. Get connection string
```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

### 5. Indexes (auto-created on startup)
OpsMind creates all required indexes automatically via `ensureIndexes()` on bootstrap. No manual index creation needed.

### 6. Vector Search (optional)
To enable semantic similarity search:

1. Set `VECTOR_SEARCH_ENABLED=true`
2. Create a Vector Search index in Atlas UI on the `decisions` collection:
```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }]
}
```
3. Name the index: `decision_vector_index`

---

## Google Cloud Setup

### Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Set `GEMINI_API_KEY` in `.env`

### Agent Builder (optional)
For Google Cloud Agent Builder integration:
1. Create a Google Cloud project
2. Enable the Vertex AI API
3. Create a service account with Vertex AI User role
4. Download the service account JSON key
5. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`
6. Set `GOOGLE_CLOUD_PROJECT_ID=your-project-id`

---

## Production Considerations

### Secrets Management
- Use Google Cloud Secret Manager for production secrets
- Never commit `.env` files with real credentials
- Rotate API keys regularly

### Agent Session Handling
The current implementation runs agent sessions synchronously (blocking HTTP request). For production:
- Move to a background job queue (Cloud Tasks, BullMQ)
- Return a `sessionId` immediately
- Poll `GET /api/agent/sessions/:id` for status
- Use Server-Sent Events for real-time pipeline progress

### Scaling
- MongoDB Atlas auto-scales with M10+ clusters
- API server is stateless — horizontal scaling works
- Agent sessions are CPU/memory intensive — scale vertically or use Cloud Run

### Monitoring
- All agent sessions are logged to MongoDB `execution_logs`
- Use MongoDB Atlas monitoring for query performance
- Set up alerts on `AGENT_REASONING_FAILED` error codes

---

## Turborepo Pipeline

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "dependsOn": ["^build"], "persistent": true },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

Build order (resolved by Turborepo):
1. `@opsmind/config`, `@opsmind/shared`
2. `@opsmind/memory`
3. `@opsmind/tools`, `@opsmind/ai`
4. `@opsmind/agent`
5. `@opsmind/api`, `@opsmind/web`
