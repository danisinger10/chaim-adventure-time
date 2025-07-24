const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    // broadcast to all clients except sender
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on ${PORT}`);
});
