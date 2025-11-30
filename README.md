# Mini Audit Trail Generator - Backend

This repository hosts the backend for the **Mini Audit Trail Generator**, a Node.js + Express application that tracks multiple versions of tasks using a **doubly linked list concept**. Each task can have multiple versions, and differences between versions (added/removed/changed words) are computed automatically. The backend uses **MongoDB Atlas** for data storage.

---

## Features

- **Task Management:** Create tasks with multiple versions.
- **Version Tracking:** Each task version stores:
  - `versionNumber`
  - `data` (title, content)
  - `diff` (added, removed, changed words)
  - `summary` (short description like "Added ~45 words")
  - `prev` and `next` pointers to navigate versions (implements **doubly linked list**)
- **Diff Generation:** Compares content with the previous version using the `diff` library.
- **Navigation:** Efficiently traverse versions forward and backward using the linked structure.
- **Stats Dashboard:** Provides total tasks, total versions, and latest task info.
- **CORS Enabled:** Configured to allow requests from the frontend URL.

---

## Doubly Linked List Concept

Each version of a task is stored as a node in a **doubly linked list**:

- `prev`: Points to the previous version (null for the first version)
- `next`: Points to the next version (null for the latest version)
- This structure allows:
  - Quick access to the previous or next version
  - Easy insertion of new versions
  - Efficient traversal and history management

**Example:**

    ## Version 1 <-> Version 2 <-> Version 3

    
---

## Tech Stack

- Node.js
- Express.js
- MongoDB (Atlas)
- Mongoose ODM
- `diff` library for content comparison
- CORS middleware

---

## API Endpoints

### Task & Version Management

#### Create a new version
```http
POST /task/:taskId/version


## Request Body:

{
  "title": "Task title",
  "content": "Task content..."
}

## Response:

{
  "message": "Version 1 created",
  "version": { /* Version Object including prev/next */ }
}


## Get all tasks
[
  {
    "taskId": "task-123",
    "title": "Latest task title"
  }
]

## GET /task/:taskId

{
  "taskId": "task-123",
  "headVersion": 1,
  "tailVersion": 3,
  "totalVersions": 3,
  "versions": [
    {
      "versionNumber": 1,
      "prev": null,
      "next": 2,
      "data": { "title": "Initial Task", "content": "..." }
    },
    {
      "versionNumber": 2,
      "prev": 1,
      "next": 3,
      "data": { "title": "Task Update", "content": "..." }
    },
    {
      "versionNumber": 3,
      "prev": 2,
      "next": null,
      "data": { "title": "Final Version", "content": "..." }
    }
  ]
}

## GET /task/:taskId/version/:versionNumber

{
  "versionNumber": 2,
  "data": { "title": "Task Update", "content": "..." },
  "diff": { "added": 5, "removed": 2, "changed": 7 },
  "summary": "Added ~5 words",
  "prev": 1,
  "next": 3,
  "navigation": { "prev": 1, "next": 3 }
}


## GET /stats

{
  "totalTasks": 5,
  "totalVersions": 12,
  "latestTask": {
    "title": "Task title",
    "timeAgo": "5m ago"
  }
}


#### Setup Instructions

-- ## Clone the repo:

git clone <repo-url>
cd backend


## Install dependencies:

npm install


## Create a .env file:

MONGODB_URI=<your-mongodb-atlas-uri>
PORT=3000


## Start the server:

npm run dev


## Server will run at http://localhost:3000.

## Notes

All versions are stored in an array inside each task document in MongoDB, but linked via prev and next to emulate a doubly linked list.

Diff stats (added, removed, changed) are computed automatically for content edits.

Summary provides a human-readable overview of changes.


If you want, I can also create a **compact “GitHub-ready” version with badges, screenshots, and usage examples** so your repo looks fully professional.  

Do you want me to do that?

