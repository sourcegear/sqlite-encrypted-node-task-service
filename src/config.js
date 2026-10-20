'use strict';

const path = require('node:path');

function readConfig(environment = process.env) {
  const activationKey = environment.SQLITE_ENCRYPTED_ACTIVATION_KEY?.trim();
  if (!activationKey) {
    throw new Error(
      'SQLITE_ENCRYPTED_ACTIVATION_KEY is required. Obtain an evaluation key ' +
      'at http://sqlite.sourcegear.com/#evaluation and add it to .env.'
    );
  }
  if (activationKey.startsWith('see-')) {
    throw new Error(
      'SQLITE_ENCRYPTED_ACTIVATION_KEY must contain the activation key without ' +
      'the "see-" prefix. That prefix is used only by the PRAGMA form.'
    );
  }

  const portText = environment.PORT?.trim() || '4310';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 through 65535; received "${portText}".`);
  }

  const root = path.resolve(__dirname, '..');
  return {
    activationKey,
    host: environment.HOST?.trim() || '127.0.0.1',
    port,
    dataDirectory: path.resolve(
      root,
      environment.SQLITE_ENCRYPTED_DATA_DIR?.trim() || 'data'
    )
  };
}

module.exports = {readConfig};
