'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {openTaskRepository} = require('../src/database');

const activationKey = process.env.SQLITE_ENCRYPTED_ACTIVATION_KEY?.trim();

test('persists tasks in a keyed SQLite.Encrypted database', {
  skip: activationKey ? false : 'SQLITE_ENCRYPTED_ACTIVATION_KEY is not set'
}, () => {
  const dataDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sqlite-encrypted-node-sample-')
  );
  let repository;

  try {
    repository = openTaskRepository({activationKey, dataDirectory});
    const created = repository.create({
      title: 'Verify the encrypted service',
      notes: 'Created by the integration test'
    });
    assert.equal(repository.get(created.id).title, created.title);
    repository.close();
    repository = undefined;

    const databaseHeader = fs.readFileSync(
      path.join(dataDirectory, 'tasks.db')
    ).subarray(0, 16).toString('utf8');
    assert.notEqual(databaseHeader, 'SQLite format 3\u0000');

    repository = openTaskRepository({activationKey, dataDirectory});
    assert.equal(repository.list('encrypted').length, 1);
  } finally {
    repository?.close();
    fs.rmSync(dataDirectory, {recursive: true, force: true});
  }
});
