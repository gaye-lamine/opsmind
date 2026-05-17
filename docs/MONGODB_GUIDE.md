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

You should already have a vector search index named `decision_vector_index`.

> [!IMPORTANT]
> **Metadata Filtering**: The OpsMind agent runtime filters vector search queries dynamically by `status` (and optionally `category`). To prevent MongoDB Atlas from throwing filtering errors, you MUST configure these metadata fields as `filter` types in your index definition.
> **Dimensions**: We use high-fidelity 1024-dimensional embeddings (Voyage AI or premium Google embeddings).

Create the index on the `decisions` collection with the following JSON configuration:

```json
{
  "fields": [
    {
      "numDimensions": 1024,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "type": "filter",
      "path": "status"
    },
    {
      "type": "filter",
      "path": "category"
    }
  ]
}
```

## How it works
Once configured, OpsMind will automatically perform **Parallel Hybrid Search**:
1. It uses **Vector Search** to find semantic matches based on meaning.
2. It uses **Atlas Search** to find exact keyword matches and fuzzy results.
3. It merges both result sets in the backend to provide the most relevant historical context.
