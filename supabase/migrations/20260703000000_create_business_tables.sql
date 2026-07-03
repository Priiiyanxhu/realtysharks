-- Create requirements table
create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid references auth.users(id) not null,
  property_type text,
  city text,
  preferred_localities text[],
  configuration text,
  budget_min_inr numeric,
  budget_max_inr numeric,
  min_square_feet numeric,
  details text,
  privacy_level text,
  required_amenities text[],
  client_profile text,
  funding_status text,
  timeline_to_close text,
  purchase_purpose text,
  expected_yield text,
  direct_mandate_only boolean default false,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.requirements enable row level security;

-- Policies for requirements
create policy "Requirements are viewable by everyone if active"
  on public.requirements for select
  using (is_active = true or auth.uid() = broker_id);

create policy "Users can insert their own requirements"
  on public.requirements for insert
  with check (auth.uid() = broker_id);

create policy "Users can update their own requirements"
  on public.requirements for update
  using (auth.uid() = broker_id);

create policy "Users can delete their own requirements"
  on public.requirements for delete
  using (auth.uid() = broker_id);


-- Create conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) not null,
  listing_id uuid references public.listings(id),
  requirement_id uuid references public.requirements(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.conversations enable row level security;

-- Create conversation_participants table
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text default 'member',
  created_at timestamp with time zone default now(),
  unique(conversation_id, user_id)
);

-- Enable RLS
alter table public.conversation_participants enable row level security;

-- Policies for conversations
create policy "Users can view conversations they are part of"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = conversations.id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() = created_by);

-- Policies for conversation_participants
create policy "Users can view participants of their conversations"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
      and cp.user_id = auth.uid()
    )
  );

create policy "Users can insert participants to conversations"
  on public.conversation_participants for insert
  with check (auth.uid() is not null); -- Allow adding participants (typically done via RPC or edge functions, but we allow authenticated inserts here for now)


-- Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references auth.users(id) not null,
  body text not null,
  attachment_url text,
  message_type text default 'text',
  status text default 'sent',
  created_at timestamp with time zone default now(),
  read_at timestamp with time zone
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies for messages
create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = conversation_id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Users can update their message status"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = auth.uid()
    )
  );

-- Function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger handle_updated_at_requirements
  before update on public.requirements
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_conversations
  before update on public.conversations
  for each row execute procedure public.handle_updated_at();

-- Indexes for performance
create index if not exists requirements_broker_id_idx on public.requirements(broker_id);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists conversation_participants_user_id_idx on public.conversation_participants(user_id);
create index if not exists conversation_participants_conversation_id_idx on public.conversation_participants(conversation_id);
