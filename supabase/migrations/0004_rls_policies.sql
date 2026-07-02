-- 0004_rls_policies.sql

-- documents
create policy "own docs full" on documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read public docs" on documents
  for select using (visibility = 'public');

-- chunks: inherit document access
create policy "read chunks of accessible docs" on chunks
  for select using (
    exists (
      select 1 from documents d
      where d.id = chunks.document_id
        and (d.owner_id = auth.uid() or d.visibility = 'public')
    )
  );
create policy "insert chunks for owned docs" on chunks
  for insert with check (
    exists (
      select 1 from documents d
      where d.id = chunks.document_id and d.owner_id = auth.uid()
    )
  );
create policy "delete chunks of owned docs" on chunks
  for delete using (
    exists (
      select 1 from documents d
      where d.id = chunks.document_id and d.owner_id = auth.uid()
    )
  );

-- conversations
create policy "own conversations" on conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- messages: inherit conversation ownership
create policy "own messages" on messages
  for all using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id and c.owner_id = auth.uid()
    )
  );

-- usage_daily
create policy "own usage" on usage_daily
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
