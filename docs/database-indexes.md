# Database Index Analysis

## Overview

This document tracks database query performance and recommended indexes for the EduStack IS SQLite/D1 database.

## Current Schema

The database schema is defined in `apps/backend/src/database/schema.sql` (for D1) and used via `DatabaseService`.

## Frequently Queried Tables

Based on the codebase analysis, these tables are queried most frequently:

### 1. `User` Table

**Common Queries:**

- Find by email (login, unique check)
- Find by ID (session validation)
- List by school + role (user management)

**Recommended Indexes:**

```sql
CREATE INDEX idx_user_email ON User(email);
CREATE INDEX idx_user_school_role ON UserMembership(schoolId, role);
```

### 2. `UserMembership` Table

**Common Queries:**

- Find by userId + schoolId (permission checks)
- List by schoolId (school users)

**Recommended Indexes:**

```sql
CREATE INDEX idx_membership_user_school ON UserMembership(userId, schoolId);
CREATE INDEX idx_membership_school ON UserMembership(schoolId);
```

### 3. `Grade` Table

**Common Queries:**

- Find by studentId + subjectInstanceId (grading)
- List by subjectInstance (class grades)

**Recommended Indexes:**

```sql
CREATE INDEX idx_grade_student ON Grade(studentId);
CREATE INDEX idx_grade_subject ON Grade(subjectInstanceId);
```

### 4. `Attendance` Table

**Common Queries:**

- Find by studentId + date (daily attendance)
- List by date range (attendance reports)

**Recommended Indexes:**

```sql
CREATE INDEX idx_attendance_student_date ON Attendance(studentId, date);
CREATE INDEX idx_attendance_date ON Attendance(date);
```

### 5. `School` Table

**Common Queries:**

- Find by name (uniqueness check)
- List active schools

**Recommended Indexes:**

```sql
CREATE INDEX idx_school_name ON School(name);
CREATE INDEX idx_school_deleted ON School(deletedAt);
```

## Query Performance Monitoring

Enable query logging in `DatabaseService` to identify slow queries:

```typescript
// In DatabaseService methods, add:
if (process.env.DEBUG_QUERIES === 'true') {
    this.logger.debug(`Query: ${sql}, Params: ${JSON.stringify(params)}`);
}
```

## How to Add Indexes

For Cloudflare D1, add indexes to `schema.sql` and run:

```bash
npm run db:init  # Re-initialize with new schema
```

For production:

```bash
npm run db:deploy  # Apply schema changes to remote D1
```

## Notes

- SQLite automatically creates indexes for PRIMARY KEY and UNIQUE constraints
- Keep indexes selective (high cardinality)
- Too many indexes can slow down INSERT/UPDATE operations
