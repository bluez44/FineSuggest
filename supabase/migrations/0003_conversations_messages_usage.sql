-- 0003_conversations_messages_usage.sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Cuộc trò chuyện mới',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_owner_updated_idx on conversations(owner_id, updated_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on messages(conversation_id, created_at);

create table usage_daily (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  question_count int not null default 0,
  primary key (user_id, day)
);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table usage_daily enable row level security;
