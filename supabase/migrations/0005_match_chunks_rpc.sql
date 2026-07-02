-- 0005_match_chunks_rpc.sql
create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 6,
  caller_user_id uuid default null
) returns table (
  id uuid,
  document_id uuid,
  content text,
  dieu text,
  khoan text,
  diem text,
  page int,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.document_id, c.content, c.dieu, c.khoan, c.diem, c.page,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where d.visibility = 'public' or d.owner_id = caller_user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function match_chunks(vector, int, uuid) from public;
grant execute on function match_chunks(vector, int, uuid) to authenticated;
