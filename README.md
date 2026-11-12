# CFT Chat API

A small chat backend built with **Node.js + TypeScript**, using:

- **PostgreSQL** (via Prisma) for **users, chats, and membership**
- **Firebase Firestore** for **messages, read receipts, and last-seen** pointers

The split follows the task: relational data (who exists, who is in which chat) lives
in Postgres; high-write, append-style chat data (messages + receipts) lives in Firestore.

## Architecture

```
HTTP (Express)
  ├── /chat/*   → chat.routes  ─┬─ chat.service    → Prisma  → PostgreSQL  (users, chats, members)
  │                             └─ message.service → Firestore            (messages, receipts, last-seen)
  └── /user/*   → user.routes  ──  user.service    → Prisma  → PostgreSQL
```

- **Postgres / Prisma** (`src/config/prisma.ts`, `prisma/schema.prisma`): `User`, `Chat`,
  `ChatMember`.
- **Firestore** (`src/config/firestore.ts`, `src/services/message.service.ts`):
  - `chats/{chatId}/messages/{messageId}` — a message doc with a `readBy` map (read receipts).
  - `chats/{chatId}/lastSeen/{userId}` — the last message each user has seen.
- The `chatId` is the Postgres chat id, reused as the Firestore document path, so the two
  stores line up without any extra mapping.
- Before writing to Firestore (send / read / last-seen) the API checks in Postgres that the
  user is actually a member of the chat.

## Prerequisites

- Node.js 18+ (developed on v24)
- A PostgreSQL database
- For Firestore, either:
  - the **Firestore emulator** (default, no Google account needed) — requires Java, or
  - a real Firebase project + service-account key.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    edit DATABASE_URL to point at your Postgres instance

# 3. Create the database schema + Prisma client
npm run prisma:migrate        # runs the migration and generates the client

# 4. (optional) Seed a few sample users and print their IDs
npm run seed
```

### Running Firestore

**Option A — emulator (recommended, default in `.env.example`):**

```bash
# needs the Firebase CLI once: npm i -g firebase-tools  (or use npx)
npm run emulator              # starts Firestore on localhost:8080
```

Keep `FIRESTORE_EMULATOR_HOST=localhost:8080` in `.env`. The Admin SDK auto-detects it and
needs no credentials.

**Option B — real Firestore:** comment out `FIRESTORE_EMULATOR_HOST` in `.env` and set
`FIREBASE_SERVICE_ACCOUNT=./service-account.json` (download the key from the Firebase console).

### Start the API

```bash
npm run dev     # watch mode (tsx)
# or
npm run build && npm start
```

Server listens on `http://localhost:3000` (configurable via `PORT`).

## API Reference

All request/response bodies are JSON. IDs are strings (cuid).

### Required endpoints

| # | Method & path | Body | Description |
|---|---|---|---|
| 1 | `POST /chat/create` | `{ userAId, userBId }` | Create or return the existing 1:1 chat |
| 2 | `POST /chat/:chatId/message/send` | `{ senderId, text }` | Send a message (stored in Firestore) |
| 3 | `GET  /chat/:chatId/messages?limit=50` | – | Latest messages, ordered oldest→newest |
| 4 | `POST /chat/:chatId/message/:messageId/read` | `{ userId }` | Record a read receipt |
| 5 | `POST /chat/:chatId/lastseen` | `{ userId, messageId }` | Update a user's last-seen message |
| 6 | `GET  /user/:userId/chats` | – | List a user's chats with member IDs |

### Bonus endpoints

| Method & path | Body | Description |
|---|---|---|
| `POST /chat/group/create` | `{ name, memberIds[] }` | Create a group chat |
| `POST /chat/:chatId/members` | `{ userId }` | Add a member to a group chat |
| `DELETE /chat/:chatId/members/:userId` | – | Remove a member from a group chat |
| `PATCH /chat/:chatId/message/:messageId` | `{ senderId, text }` | Edit a message (sender only) |
| `DELETE /chat/:chatId/message/:messageId` | `{ senderId }` | Soft-delete a message (sender only) |

### Helper endpoints (beyond the spec, for easy testing)

| Method & path | Body | Description |
|---|---|---|
| `POST /user` | `{ name, email? }` | Create a user |
| `GET  /user` | – | List all users |
| `GET  /health` | – | Health check |

## Example walkthrough

```bash
# Create two users (or use `npm run seed`)
A=$(curl -s -X POST localhost:3000/user -H 'content-type: application/json' \
     -d '{"name":"Alice"}' | jq -r .id)
B=$(curl -s -X POST localhost:3000/user -H 'content-type: application/json' \
     -d '{"name":"Bob"}' | jq -r .id)

# Create (or get) their 1:1 chat
CHAT=$(curl -s -X POST localhost:3000/chat/create -H 'content-type: application/json' \
     -d "{\"userAId\":\"$A\",\"userBId\":\"$B\"}" | jq -r .chatId)

# Send a message
MSG=$(curl -s -X POST localhost:3000/chat/$CHAT/message/send -H 'content-type: application/json' \
     -d "{\"senderId\":\"$A\",\"text\":\"Hello Bob!\"}" | jq -r .id)

# Read the messages
curl -s "localhost:3000/chat/$CHAT/messages?limit=50" | jq

# Bob marks the message read + updates last-seen
curl -s -X POST localhost:3000/chat/$CHAT/message/$MSG/read -H 'content-type: application/json' \
     -d "{\"userId\":\"$B\"}"
curl -s -X POST localhost:3000/chat/$CHAT/lastseen -H 'content-type: application/json' \
     -d "{\"userId\":\"$B\",\"messageId\":\"$MSG\"}"

# List Bob's chats
curl -s localhost:3000/user/$B/chats | jq
```

## Design notes

- **Create-or-get is idempotent**: `POST /chat/create` with the same two users always
  returns the same chat, regardless of argument order.
- **Ordering**: messages are stored with a Firestore `Timestamp` and returned sorted by
  `createdAt`. `GET /messages` fetches the newest `limit` and returns them oldest→newest.
- **Read receipts** are stored as a `readBy` map on each message doc (`userId → readAt`), so
  one document read yields all receipts for that message.
- **Delete is a soft delete** (`deleted: true`, `text` nulled in responses) so message
  ordering/history stays intact.
- **Validation** uses `zod` at the edge; failures return `400` with field-level details.
  `AppError` carries HTTP status codes (`404` not found, `403` not a member, etc.).

## Project layout

```
prisma/
  schema.prisma        # User, Chat, ChatMember
  seed.ts              # sample users
src/
  config/              # env, prisma client, firestore init
  middleware/          # central error handler
  routes/              # chat + user routers (thin, validate then call services)
  services/            # chat/user (Postgres), message (Firestore)
  utils/               # AppError + asyncHandler
  app.ts  index.ts     # express app + bootstrap
```
