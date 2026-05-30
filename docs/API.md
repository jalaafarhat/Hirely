# Hirely API Contracts

Base URL: `http://localhost:3000/api/v1`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

---

## Auth

### POST /auth/register
```json
// Request
{ "email": "user@example.com", "password": "SecurePass123!", "name": "Jane Doe" }

// Response 201
{ "message": "Verification email sent" }
```

### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "SecurePass123!" }

// Response 200
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "USER" }
}
```

### POST /auth/refresh
```json
// Request
{ "refreshToken": "..." }

// Response 200
{ "accessToken": "...", "refreshToken": "..." }
```

### POST /auth/logout
```json
// Request
{ "refreshToken": "..." }

// Response 200
{ "message": "Logged out" }
```

### POST /auth/verify-email
```json
// Request
{ "token": "verification-token" }

// Response 200
{ "message": "Email verified" }
```

### POST /auth/forgot-password
```json
// Request
{ "email": "user@example.com" }

// Response 200
{ "message": "If account exists, reset email sent" }
```

### POST /auth/reset-password
```json
// Request
{ "token": "reset-token", "password": "NewSecurePass123!" }

// Response 200
{ "message": "Password reset successful" }
```

---

## User Profile

### GET /users/me
```json
// Response 200
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "role": "USER",
  "emailVerified": true,
  "timezone": "America/New_York",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### PATCH /users/me
```json
// Request
{ "name": "Jane Smith", "timezone": "Europe/London" }
```

---

## CV & Profile

### POST /cv/upload
`multipart/form-data` — field: `file` (PDF or DOCX)

```json
// Response 201
{
  "id": "uuid",
  "filename": "resume.pdf",
  "uploadedAt": "2026-01-01T00:00:00Z",
  "profile": { /* ParsedProfile */ }
}
```

### GET /cv
```json
// Response 200
{
  "file": { "id": "uuid", "filename": "...", "uploadedAt": "..." },
  "profile": {
    "name": "", "email": "", "phone": "", "summary": "",
    "jobTitles": [], "skills": [], "technologies": [],
    "yearsExperience": 0, "education": [], "certifications": [],
    "industries": [], "languages": [], "locations": [], "seniority": ""
  }
}
```

### DELETE /cv
```json
// Response 200
{ "message": "CV deleted" }
```

---

## Preferences

### GET /preferences
```json
// Response 200
{
  "locationType": "WORLDWIDE",
  "country": null,
  "city": null,
  "workModes": ["REMOTE", "HYBRID"],
  "jobTypes": ["FULL_TIME"],
  "minSalary": 80000,
  "matchThreshold": 75,
  "agentEnabled": true
}
```

### PUT /preferences
```json
// Request
{
  "locationType": "COUNTRY",
  "country": "US",
  "workModes": ["REMOTE"],
  "jobTypes": ["FULL_TIME", "CONTRACT"],
  "minSalary": 100000,
  "matchThreshold": 80,
  "agentEnabled": true
}
```

---

## Jobs

### GET /jobs
Query: `?page=1&limit=20&minScore=75&source=linkedin&workMode=remote&sort=score`

```json
// Response 200
{
  "data": [{
    "id": "uuid",
    "title": "Senior Angular Developer",
    "company": "TechCorp",
    "location": "Remote",
    "salary": "$120k-$150k",
    "url": "https://...",
    "source": "linkedin",
    "postedDate": "2026-05-28",
    "matchScore": 94,
    "reasoning": "Strong Angular match...",
    "workMode": "REMOTE",
    "status": "NEW"
  }],
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

### POST /jobs/:id/save
### DELETE /jobs/:id/save
### POST /jobs/:id/hide
### POST /jobs/:id/applied

### POST /jobs/:id/feedback
```json
// Request
{ "type": "INTERESTED" | "NOT_INTERESTED" }
```

---

## Dashboard

### GET /dashboard/stats
```json
// Response 200
{
  "newJobsToday": 5,
  "jobsThisWeek": 23,
  "averageMatchScore": 87,
  "totalJobsMatched": 156,
  "emailsSent": 12
}
```

---

## Saved Jobs

### GET /saved-jobs
Same shape as GET /jobs filtered to saved.

---

## Admin

Requires `role: ADMIN`.

### GET /admin/users
### GET /admin/cvs
### GET /admin/jobs
### GET /admin/email-logs
### GET /admin/agent-runs
### GET /admin/stats

```json
// GET /admin/stats Response
{
  "totalUsers": 150,
  "activeUsers": 89,
  "totalJobs": 12500,
  "emailsSentToday": 45,
  "agentRunsToday": 89,
  "averageMatchScore": 82
}
```

---

## Error Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```
