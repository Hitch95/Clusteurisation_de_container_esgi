import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { URL } from 'url';
import * as os from 'os';

type JsonPayload = Record<string, unknown>;

function sendJson(response: ServerResponse, statusCode: number, payload: JsonPayload): void {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });

  response.end(body);
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const method = request.method || 'GET';

  if (method === 'GET' && pathname === '/') {
    sendJson(response, 200, { hostname: os.hostname() });
    return;
  }

  if (method === 'GET' && pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (pathname === '/' || pathname === '/health') {
    sendJson(response, 405, { message: 'Méthode non autorisée.' });
    return;
  }

  sendJson(response, 404, { message: 'Route introuvable.' });
}

export function createApp(): Server {
  return createServer(handleRequest);
}