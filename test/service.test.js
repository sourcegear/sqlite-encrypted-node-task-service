'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {createService} = require('../src/service');

class MemoryRepository {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
  }

  get(id) {
    return this.tasks.find(task => task.id === id) || null;
  }

  list(search) {
    const needle = search.toLocaleLowerCase();
    return this.tasks.filter(task =>
      task.title.toLocaleLowerCase().includes(needle) ||
      task.notes.toLocaleLowerCase().includes(needle)
    );
  }

  create(value) {
    const now = new Date().toISOString();
    const task = {...value, id: this.nextId++, completed: false, createdAt: now, updatedAt: now};
    this.tasks.push(task);
    return task;
  }

  update(id, value) {
    const task = this.get(id);
    if (!task) return null;
    Object.assign(task, value, {updatedAt: new Date().toISOString()});
    return task;
  }

  delete(id) {
    const index = this.tasks.findIndex(task => task.id === id);
    if (index < 0) return false;
    this.tasks.splice(index, 1);
    return true;
  }
}

async function withServer(callback) {
  const server = http.createServer(createService(new MemoryRepository()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('creates, searches, completes, and deletes encrypted-service tasks', async () => {
  await withServer(async baseUrl => {
    const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: 'Rotate field key', notes: 'Before Friday'})
    });
    assert.equal(createdResponse.status, 201);
    const {task: created} = await createdResponse.json();
    assert.equal(created.title, 'Rotate field key');
    assert.equal(created.completed, false);

    const searchResponse = await fetch(`${baseUrl}/api/tasks?search=field`);
    assert.equal(searchResponse.status, 200);
    assert.equal((await searchResponse.json()).tasks.length, 1);

    const updateResponse = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({completed: true})
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).task.completed, true);

    const deleteResponse = await fetch(`${baseUrl}/api/tasks/${created.id}`, {method: 'DELETE'});
    assert.equal(deleteResponse.status, 204);
    assert.deepEqual((await (await fetch(`${baseUrl}/api/tasks`)).json()).tasks, []);
  });
});

test('returns useful validation errors without exposing internals', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: '   '})
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {error: 'title must be a non-empty string.'});
  });
});
