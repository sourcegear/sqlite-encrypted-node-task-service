'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {readConfig} = require('../src/config');

test('requires the activation key', () => {
  assert.throws(
    () => readConfig({}),
    /SQLITE_ENCRYPTED_ACTIVATION_KEY is required/u
  );
});

test('rejects the PRAGMA-only activation prefix', () => {
  assert.throws(
    () => readConfig({SQLITE_ENCRYPTED_ACTIVATION_KEY: 'see-example'}),
    /without the "see-" prefix/u
  );
});

test('uses local-only defaults', () => {
  const config = readConfig({SQLITE_ENCRYPTED_ACTIVATION_KEY: 'example'});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 4310);
  assert.match(config.dataDirectory, /[\\/]data$/u);
});
