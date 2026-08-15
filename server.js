const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'Public')));

// Map de salas: roomId -> { clients: Set, timer: Timeout }
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);

      if (data.type === 'create_room') {
        currentRoom = data.roomId;
        
        // Cria sala com expiração automática de 65s (margem de rede)
        const expireTimer = setTimeout(() => {
          if (rooms.has(currentRoom) && rooms.get(currentRoom).clients.size < 2) {
            rooms.delete(currentRoom);
          }
        }, 65000);

        rooms.set(currentRoom, { clients: new Set([ws]), timer: expireTimer });
        return;
      }

      if (data.type === 'join_room') {
        currentRoom = data.roomId;
        const room = rooms.get(currentRoom);

        // Se a sala não existe ou expirou
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'QR Code expirado ou inválido.' }));
          return;
        }

        // Cancela o timer de expiração pois o pareamento ocorreu
        clearTimeout(room.timer);
        room.clients.add(ws);

        // Notifica ambos que a conexão foi firmada
        room.clients.forEach((client) => {
          client.send(JSON.stringify({ type: 'connected' }));
        });
        return;
      }

      // Repasse de dados (Texto, Código, Ofertas de Arquivo)
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    } catch (e) {
      console.error('Falha ao processar pacote:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      clearTimeout(room.timer);
      room.clients.delete(ws);

      // Notifica o outro lado e destrói a sala imediatamente
      room.clients.forEach((client) => {
        client.send(JSON.stringify({ type: 'peer_disconnected' }));
      });
      rooms.delete(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Bridge ativo na porta ${PORT}`));
