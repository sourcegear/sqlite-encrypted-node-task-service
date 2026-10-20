'use strict';

const MAX_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }

  if (chunks.length === 0) throw new HttpError(400, 'A JSON request body is required.');
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new Error('not an object');
    }
    return value;
  } catch {
    throw new HttpError(400, 'The request body must be a JSON object.');
  }
}

function requiredText(value, name, maximumLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${name} must be a non-empty string.`);
  }
  const result = value.trim();
  if (result.length > maximumLength) {
    throw new HttpError(400, `${name} must be at most ${maximumLength} characters.`);
  }
  return result;
}

function optionalText(value, name, maximumLength) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be a string.`);
  const result = value.trim();
  if (result.length > maximumLength) {
    throw new HttpError(400, `${name} must be at most ${maximumLength} characters.`);
  }
  return result;
}

function taskId(pathname) {
  const match = /^\/api\/tasks\/(\d+)$/u.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function createService(repository, {onError = console.error} = {}) {
  return async function service(request, response) {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {status: 'ready', encrypted: true});
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/tasks') {
        const search = (url.searchParams.get('search') || '').trim();
        if (search.length > 120) throw new HttpError(400, 'search is too long.');
        sendJson(response, 200, {tasks: repository.list(search)});
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(request);
        const task = repository.create({
          title: requiredText(body.title, 'title', 120),
          notes: optionalText(body.notes, 'notes', 4000)
        });
        sendJson(response, 201, {task});
        return;
      }

      const id = taskId(url.pathname);
      if (id && request.method === 'PATCH') {
        const existing = repository.get(id);
        if (!existing) throw new HttpError(404, 'Task not found.');
        const body = await readJson(request);
        if (body.completed !== undefined && typeof body.completed !== 'boolean') {
          throw new HttpError(400, 'completed must be true or false.');
        }
        const task = repository.update(id, {
          title: body.title === undefined
            ? existing.title
            : requiredText(body.title, 'title', 120),
          notes: body.notes === undefined
            ? existing.notes
            : optionalText(body.notes, 'notes', 4000),
          completed: body.completed ?? existing.completed
        });
        sendJson(response, 200, {task});
        return;
      }

      if (id && request.method === 'DELETE') {
        if (!repository.delete(id)) throw new HttpError(404, 'Task not found.');
        response.writeHead(204, {'Cache-Control': 'no-store'});
        response.end();
        return;
      }

      throw new HttpError(404, 'Route not found.');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) onError(error);
      sendJson(response, status, {
        error: status === 500 ? 'Internal service error.' : error.message
      });
    }
  };
}

module.exports = {createService};
