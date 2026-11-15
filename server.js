const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ics': 'text/calendar',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0];
  if (file === '/') file = '/index.html';
  const filePath = path.join(__dirname, decodeURIComponent(file));
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    }
  });
});

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`\n==================================================`);
  console.log(`Athulraj & Aiswarya Wedding Invitation`);
  console.log(`Local link:  http://localhost:${PORT}`);
  console.log(`Mobile link: http://${ip}:${PORT}`);
  console.log(`==================================================\n`);
});
