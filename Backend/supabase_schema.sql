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

-- UPLOAD SESSIONS
create table upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  file_key text not null,
  classroom_id uuid,
  expires_at timestamp not null,
  created_at timestamp default now()
);