# MongoDB Atlas Search Configuration Guide

To enable Hybrid Search in OpsMind, you need to create a Search Index in your MongoDB Atlas cluster.

## 1. Create the Full-Text Search Index

1. Log in to **MongoDB Atlas**.
2. Go to **Search** in the left sidebar.
3. Click **Create Search Index**.
4. Select **JSON Editor** and click **Next**.
5. Select the `opsmind` database and the `decisions` collection.
6. Name the index: `default`
7. Paste the following JSON configuration:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "goal": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "summary": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "findings": {
        "type": "document",
        "fields": {
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        }
      }
    }
  }
}
```
8. Click **Next** and then **Create Search Index**.

## 2. Ensure Vector Search Index Exists

You should already have a vector search index named `decision_vector_index`. If not, create it with this JSON:

```json
{
  "fields": [
    {
      "numDimensions": 768,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```

## How it works
Once configured, OpsMind will automatically perform **Parallel Hybrid Search**:
1. It uses **Vector Search** to find semantic matches based on meaning.
2. It uses **Atlas Search** to find exact keyword matches and fuzzy results.
3. It merges both result sets in the backend to provide the most relevant historical context.
