CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  student_number TEXT,
  course TEXT,
  section TEXT,
  role TEXT NOT NULL CHECK(role IN ('Super_Admin', 'Admin', 'Authorized_User', 'Student')),
  active_flag INTEGER DEFAULT 1,
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME,
  last_login DATETIME,
  created_by TEXT,
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  deleted_at DATETIME
);
