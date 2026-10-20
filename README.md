# Node.js encrypted local task service

This sample is a small, localhost-only JSON API backed by an encrypted SQLite
database. It demonstrates the published `@sqlite-encrypted/node` package with
Node's built-in HTTP server, so SQLite.Encrypted is the application's only
runtime dependency.

The sample:

- activates SEE and verifies activation before touching the application database;
- opens the database with the keyed `DatabaseSync` constructor;
- generates a random 32-byte database key on first run;
- keeps the database and its key out of source control;
- uses prepared statements for task CRUD and search; and
- binds to `127.0.0.1` unless explicitly configured otherwise.

## Requirements

- Node.js 22.5 or later
- a SQLite.Encrypted SEE activation key valid for this platform and SQLite 3.54

You can request an evaluation key at
[sqlite.sourcegear.com/#evaluation](http://sqlite.sourcegear.com/#evaluation).

## Install and run

```powershell
cd sqlite-encrypted-node-task-service
Copy-Item .env.example .env
```

Set `SQLITE_ENCRYPTED_ACTIVATION_KEY` in `.env` to the activation key itself.
Do not include the `see-` prefix; that prefix is only for PRAGMA activation.
Then run:

```powershell
npm install
npm start
```

The `.npmrc` file directs the SQLite.Encrypted scope to
`https://packages.sourcegear.com/npm/`. The API starts at
`http://127.0.0.1:4310` by default.

If the activation key is missing or rejected, startup stops with an actionable
error rather than continuing with an unusable database.

## Try the API

Create a task:

```powershell
$task = Invoke-RestMethod http://127.0.0.1:4310/api/tasks `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"title":"Rotate the field key","notes":"Complete before Friday"}'
$task
```

List or search tasks:

```powershell
Invoke-RestMethod http://127.0.0.1:4310/api/tasks
Invoke-RestMethod 'http://127.0.0.1:4310/api/tasks?search=field'
```

Complete and delete a task:

```powershell
Invoke-RestMethod "http://127.0.0.1:4310/api/tasks/$($task.task.id)" `
  -Method Patch `
  -ContentType 'application/json' `
  -Body '{"completed":true}'

Invoke-RestMethod "http://127.0.0.1:4310/api/tasks/$($task.task.id)" `
  -Method Delete
```

The health endpoint reports readiness without returning secrets:

```powershell
Invoke-RestMethod http://127.0.0.1:4310/health
```

## Key storage

On first run the service writes `data/tasks.key` and `data/tasks.db`. Both are
ignored by Git. On Unix-like systems the sample requests owner-only permissions
for the key file. For a production service, replace this file with your platform
secret manager and use appropriate filesystem ACLs, backup, and key-rotation
procedures. Back up the database key separately: the encrypted database cannot
be recovered without it.

The service deliberately defaults to a loopback address and implements no user
authentication. Add authentication and TLS before exposing an API beyond the
local machine.

## Test

The HTTP tests use an in-memory repository and do not require an activation key.
When `SQLITE_ENCRYPTED_ACTIVATION_KEY` is present, the test suite also creates,
closes, and reopens a temporary encrypted database:

```powershell
npm test
npm run check
```

To run the integration test from an existing environment variable without an
`.env` file:

```powershell
$env:SQLITE_ENCRYPTED_ACTIVATION_KEY = '<your activation key>'
npm test
```
