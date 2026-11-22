const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const children = new Set();
const servers = new Set();
let shuttingDown = false;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function serveStatic(directory, port, label) {
  const server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    const filePath = path.resolve(directory, `.${pathname}`);
    const relativePath = path.relative(directory, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError) {
        response.writeHead(statError.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }

      const target = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const stream = fs.createReadStream(target);
      stream.on('open', () => {
        response.writeHead(200, {
          'Content-Type': contentTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        stream.pipe(response);
      });
      stream.on('error', (error) => {
        if (!response.headersSent) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500);
        }
        response.end(error.code === 'ENOENT' ? 'Not found' : 'Unable to read file');
      });
    });
  });

  let currentPort = port;
  server.on('error', (error) => {
    if ((error.code === 'EACCES' || error.code === 'EADDRINUSE') && currentPort < port + 20) {
      currentPort += 1;
      console.warn(`[${label}] Port ${currentPort - 1} indisponible, nouvel essai sur ${currentPort}...`);
      server.listen(currentPort, '127.0.0.1');
      return;
    }
    console.error(`[${label}] ${error.message}`);
    stop(1);
  });
  server.listen(currentPort, '127.0.0.1', () => {
    console.log(`[${label}] http://localhost:${currentPort}`);
  });
  servers.add(server);
}

function startChild(command, args, cwd, label, options = {}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[${label}] ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[${label}] exited ${signal ? `after ${signal}` : `with code ${code}`}`);
      stop(code || 1);
    }
  });
}

function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const server of servers) server.close();
  for (const child of children) child.kill('SIGTERM');
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

const adminVite = path.join(root, 'shopika-admin', 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(adminVite)) {
  console.error('[Admin] Dépendances absentes. Exécutez "npm install --prefix shopika-admin", puis relancez.');
  process.exit(1);
}

startChild(process.execPath, ['src/server.js'], root, 'API', {
  env: {
    ...process.env,
    PORT: '4000',
    CLIENT_APP_URL: 'http://localhost:3000',
    FRONT_URL: 'http://localhost:3000',
    MERCHANT_APP_URL: 'http://localhost:5500',
  },
});
startChild(
  process.execPath,
  [
    adminVite,
    '--host',
    '127.0.0.1',
    '--port',
    '5173',
    '--strictPort',
  ],
  path.join(root, 'shopika-admin'),
  'Admin'
);
serveStatic(path.join(root, 'shopika-front'), 3000, 'Client');
serveStatic(path.join(root, 'SHOPIKA_marchand'), 5500, 'Merchant');
