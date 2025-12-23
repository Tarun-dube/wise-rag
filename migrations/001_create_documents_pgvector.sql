-- Migration 001: Create documents table with pgvector embedding column
--
-- Notes:
--  - Requires the pgvector extension to be installed on the Postgres server.
--  - Creating extensions usually requires a superuser or a role with CREATE privileges.
--  - Adjust the embedding dimension (currently 1536) to match your embedding model.
--  - ivfflat index improves search speed for large datasets; tune `lists` for your data.

BEGIN;

-- Create the pgvector extension (name is usually 'pgvector')
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  -- Change the dimension (1536) to match your embeddings (e.g. 1536 for OpenAI text-embedding-3 family)
  embedding vector(1536)
);

-- Example: create an IVF-Flat index for faster approximate nearest neighbor searches using L2 distance
-- Tune `lists` according to dataset size (e.g. 100-1000). Re-create the index after bulk inserts for best performance.
CREATE INDEX IF NOT EXISTS documents_embedding_ivfflat_l2
  ON documents USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);

-- If you prefer cosine similarity, use vector_cosine_ops instead:
-- CREATE INDEX IF NOT EXISTS documents_embedding_ivfflat_cos
--   ON documents USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Alternatively, for HNSW (if supported/desired):
-- CREATE INDEX IF NOT EXISTS documents_embedding_hnsw
--   ON documents USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 200);

COMMIT;
