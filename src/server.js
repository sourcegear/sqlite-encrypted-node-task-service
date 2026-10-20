'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {readConfig} = require('./config');
const {openTaskRepository} = require('./database');
const {createService} = require('./service');

function main() {
  const environmentFile = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(environmentFile)) process.loadEnvFile(environmentFile);
  const config = readConfig();
  const repository = openTaskRepository(config);
  const server = http.createServer(createService(repository));

  server.listen(config.port, config.host, () => {
    console.log(`SQLite.Encrypted task service listening at http://${config.host}:${config.port}`);
    console.log(`Encrypted database directory: ${config.dataDirectory}`);
  });

  const shutdown = signal => {
    console.log(`\n${signal} received; stopping service.`);
    server.close(() => {
      repository.close();
      process.exitCode = 0;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  if (error.cause) console.error(`Details: ${error.cause.message}`);
  process.exitCode = 1;
}
