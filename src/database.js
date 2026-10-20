'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync, activateSEE} = require('@sqlite-encrypted/node');

const DATABASE_FILENAME = 'tasks.db';
const DATABASE_KEY_FILENAME = 'tasks.key';

function createDatabaseKey(dataDirectory) {
  fs.mkdirSync(dataDirectory, {recursive: true, mode: 0o700});
  const filename = path.join(dataDirectory, DATABASE_KEY_FILENAME);

  try {
    const existing = fs.readFileSync(filename, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/iu.test(existing)) {
      throw new Error(`${filename} does not contain the expected 32-byte hexadecimal key.`);
    }
    return existing;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(filename, `${generated}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    });
    return generated;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(filename, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/iu.test(existing)) {
      throw new Error(`${filename} does not contain the expected 32-byte hexadecimal key.`);
    }
    return existing;
  }
}

function activateAndVerify(activationKey) {
  try {
    activateSEE(activationKey);
    const probe = new DatabaseSync(':memory:', {
      key: 'sqlite-encrypted-node-activation-probe'
    });
    try {
      probe.exec('CREATE TABLE activation_probe(value INTEGER)');
    } finally {
      probe.close();
    }
  } catch (cause) {
    throw new Error(
      'SQLite.Encrypted could not activate SEE. Verify that ' +
      'SQLITE_ENCRYPTED_ACTIVATION_KEY is valid for this platform and SQLite version.',
      {cause}
    );
  }
}

function taskFromRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    notes: row.notes,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class TaskRepository {
  constructor(database) {
    this.database = database;
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.statements = {
      get: database.prepare(`
        SELECT id, title, notes, completed, created_at, updated_at
        FROM tasks WHERE id = ?
      `),
      listAll: database.prepare(`
        SELECT id, title, notes, completed, created_at, updated_at
        FROM tasks ORDER BY completed ASC, updated_at DESC, id DESC
      `),
      search: database.prepare(`
        SELECT id, title, notes, completed, created_at, updated_at
        FROM tasks
        WHERE title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\'
        ORDER BY completed ASC, updated_at DESC, id DESC
      `),
      insert: database.prepare(`
        INSERT INTO tasks(title, notes, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `),
      update: database.prepare(`
        UPDATE tasks
        SET title = ?, notes = ?, completed = ?, updated_at = ?
        WHERE id = ?
      `),
      delete: database.prepare('DELETE FROM tasks WHERE id = ?')
    };
  }

  get(id) {
    return taskFromRow(this.statements.get.get(id));
  }

  list(search = '') {
    if (!search) return this.statements.listAll.all().map(taskFromRow);
    const escaped = search.replace(/[\\%_]/gu, character => `\\${character}`);
    const pattern = `%${escaped}%`;
    return this.statements.search.all(pattern, pattern).map(taskFromRow);
  }

  create({title, notes}) {
    const now = new Date().toISOString();
    const result = this.statements.insert.run(title, notes, 0, now, now);
    return this.get(Number(result.lastInsertRowid));
  }

  update(id, task) {
    const result = this.statements.update.run(
      task.title,
      task.notes,
      task.completed ? 1 : 0,
      new Date().toISOString(),
      id
    );
    return result.changes === 0 ? null : this.get(id);
  }

  delete(id) {
    return this.statements.delete.run(id).changes > 0;
  }

  close() {
    if (this.database.isOpen) this.database.close();
  }
}

function openTaskRepository({activationKey, dataDirectory}) {
  activateAndVerify(activationKey);
  const databaseKey = createDatabaseKey(dataDirectory);
  const database = new DatabaseSync(path.join(dataDirectory, DATABASE_FILENAME), {
    key: databaseKey,
    timeout: 5000
  });

  try {
    return new TaskRepository(database);
  } catch (error) {
    database.close();
    throw error;
  }
}

module.exports = {
  TaskRepository,
  activateAndVerify,
  createDatabaseKey,
  openTaskRepository
};
