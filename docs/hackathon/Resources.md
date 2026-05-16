# Google Cloud Rapid Agent Hackathon - Resources

## 🛠 Phase 1: Environment
- **Managed**: Google Cloud Agent Builder.
- **SDK**: Gemini Enterprise Agent Platform SDK.
- **Credits**: Request $100 credits via [this form](https://forms.gle/xfv9vQzfRfNCCVbG7).

## 🔗 Phase 2: Actions & Data
- **Tool Use**: Agent Builder Extensions (Connect to external APIs).
- **Grounding**: Data Stores (PDFs, Websites, BigQuery).

## 🧠 Phase 4: Reasoning & State
- **Runtime**: Agent Runtime for Python/LangChain (though we use a custom TS runtime).
- **Secrets**: **Secret Manager** is the standard for API keys (GitLab, MongoDB).

## 🚀 Phase 5: Deployment & Safety
- **Deployment**: Agent Builder Deployment (Web interface).
- **Custom Hosting**: **Cloud Run** (Ideal for our Express API).
- **Safety**: Gemini Safety Settings (Filters and constraints).

## 📅 Important Events
- **May 26**: "Secure AI Agent Deployment with GitLab and Gemini" (Crucial for our GitLab integration).
- **May 27**: "Power Your AI Agent with Data (Fivetran & MongoDB)".

## 💡 OpsMind Action Items
- [ ] Migrate `.env` secrets to **Google Cloud Secret Manager**.
- [ ] Plan deployment of the API and Dashboard on **Cloud Run**.
- [ ] Review Gemini **Safety Settings** to ensure the agent follows constraints during GitLab issue creation.
