-- 0002_documents_and_chunks.sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  visibility text not null check (visibility in ('public', 'private')),
  source_type text not null check (source_type in ('pdf', 'docx', 'txt', 'md', 'url')),
  title text not null,
  storage_path text,
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index documents_owner_id_idx on documents(owner_id);
create index documents_visibility_idx on documents(visibility);
create index documents_status_idx on documents(status) where status = 'pending';

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  ordinal int not null,
  content text not null,
  embedding vector(768) not null,
  dieu text,
  khoan text,
  diem text,
  page int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create index chunks_document_id_idx on chunks(document_id);
create index chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table documents enable row level security;
alter table chunks enable row level security;
