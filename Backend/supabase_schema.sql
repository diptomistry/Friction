-- USERS
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text check (role in ('student','teacher','admin')) not null,
  is_active boolean default true,
  created_at timestamp default now()
);

-- CLASSROOMS
create table classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid references users(id),
  created_at timestamp default now()
);

-- CLASSROOM STUDENTS
create table classroom_students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references classrooms(id),
  student_id uuid references users(id)
);

-- MARKS
create table marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id),
  classroom_id uuid references classrooms(id),
  marks integer,
  updated_at timestamp default now()
);

-- TOKEN BLACKLIST (FRICTION)
create table token_blacklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  jti text not null,
  expires_at timestamp not null
);
create table files (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid references users(id) on delete cascade,
  classroom_id uuid references classrooms(id) on delete cascade,

  file_id uuid unique not null, -- public-safe ID (NEVER expose storage path)

  temp_key text not null,
  final_key text,

  status text check (
    status in ('draft','scheduled','published','expired')
  ) default 'draft',
  publish_at timestamp,

  created_at timestamp default now()
);

create table file_schedules (
  id uuid primary key default gen_random_uuid(),

  file_id uuid references files(file_id) on delete cascade,
  classroom_id uuid references classrooms(id) on delete cascade,

  publish_at timestamp not null,

  created_at timestamp default now()
);

create table file_access_logs (
  id uuid primary key default gen_random_uuid(),

  file_id uuid references files(file_id) on delete cascade,
  user_id uuid references users(id) on delete cascade,

  accessed_at timestamp default now()
);

alter table file_schedules
  alter column publish_at type timestamptz
  using publish_at at time zone 'UTC';

alter table files
  alter column publish_at type timestamptz
  using publish_at at time zone 'UTC';