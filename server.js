const express = require('express');
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(
  express.static(
    path.join(__dirname, 'Public')
  )
);


app.get(
  '/network-id',
  (req, res) => {

    const ip =
      getClientIp(
        req
      );


    const networkId =
      crypto
        .createHash(
          'sha256'
        )
        .update(
          ip
        )
        .digest(
          'hex'
        )
        .slice(
          0,
          16
        );


    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );


    res.json({
      networkId
    });

  }
);


// =========================
// SALAS
// =========================

const rooms = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded || req.socket.remoteAddress || '').split(',')[0];

  return String(raw).trim().replace(/^::ffff:/, '');
}

function getNearbyDevices(
  forClient
) {

  const devicesById =
    new Map();


  const now =
    Date.now();


  wss.clients.forEach(
    (client) => {

      const recentlySeen =
        client.lastSeen &&
        now -
          client.lastSeen <
          12000;


      if (
        client !==
          forClient &&

        client.readyState ===
          WebSocket.OPEN &&

        client.available &&

        recentlySeen &&

        !client.activeRoom &&

        client.deviceId &&

        client.networkKey ===
          forClient.networkKey
      ) {

        const previous =
          devicesById.get(
            client.deviceId
          );


        if (
          !previous ||
          (client.registeredAt || 0) >
            (previous.registeredAt || 0)
        ) {

          devicesById.set(
            client.deviceId,
            client
          );

        }

      }

    }
  );


  return Array
    .from(
      devicesById.values()
    )
    .map(
      (client) => ({

        deviceId:
          client.deviceId,

        deviceName:
          client.deviceName,

        deviceType:
          client.deviceType

      })
    );

}

function sendNearbyDevices(client) {
  safeSend(client, {
    type: 'nearby_devices',
    devices: getNearbyDevices(client)
  });
}

function broadcastNearby(networkKey) {
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.networkKey === networkKey
    ) {
      sendNearbyDevices(client);
    }
  });
}

function findDevice(deviceId) {
  let newest = null;

  for (
    const client
    of wss.clients
  ) {
    if (
      client.deviceId ===
        deviceId &&
      client.readyState ===
        WebSocket.OPEN
    ) {
      if (
        !newest ||
        (client.registeredAt || 0) >
          (newest.registeredAt || 0)
      ) {
        newest =
          client;
      }
    }
  }

  return newest;
}

function createDirectRoom(first, second) {
  cleanupOwnerPendingRooms(first);
  cleanupOwnerPendingRooms(second);

  const roomId =
    `direct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  rooms.set(roomId, {
    owner: first,
    clients: new Set([first, second]),
    paired: true,
    timer: null
  });

  first.activeRoom = roomId;
  second.activeRoom = roomId;
  first.available = false;
  second.available = false;

  safeSend(first, { type: 'connected', roomId });
  safeSend(second, { type: 'connected', roomId });

  broadcastNearby(first.networkKey);
  if (second.networkKey !== first.networkKey) {
    broadcastNearby(second.networkKey);
  }
}



// =========================
// ENVIAR COM SEGURANÇA
// =========================

function safeSend(client, data) {

  if (
    client &&
    client.readyState === WebSocket.OPEN
  ) {

    client.send(
      JSON.stringify(data)
    );

  }

}


// =========================
// DESTRUIR SALA
// =========================

function destroyRoom(
  roomId,
  closeSockets = false
) {

  const room =
    rooms.get(roomId);

  if (!room) return;


  clearTimeout(
    room.timer
  );


  if (closeSockets) {

    room.clients.forEach(
      (client) => {

        try {

          client.close(
            1000,
            'Sessão encerrada'
          );

        } catch {}

      }
    );

  }


  rooms.delete(
    roomId
  );

}


// =========================
// LIMPAR QRs ANTIGOS
// =========================

function cleanupOwnerPendingRooms(
  owner,
  keepRoomId = null
) {

  for (
    const [roomId, room]
    of rooms.entries()
  ) {

    if (
      room.owner === owner &&
      !room.paired &&
      roomId !== keepRoomId
    ) {

      destroyRoom(
        roomId
      );

    }

  }

}


// =========================
// HEARTBEAT
// =========================

function heartbeat() {

  this.isAlive = true;

}


// =========================
// WEBSOCKET
// =========================

wss.on(
  'connection',
  (ws, req) => {

    ws.activeRoom = null;
    ws.isAlive = true;
    ws.deviceId = null;
    ws.deviceName = null;
    ws.deviceType = null;
    ws.available = false;
    ws.registeredAt = 0;
    ws.lastSeen = Date.now();
    ws.networkKey = getClientIp(req);


    ws.on(
      'pong',
      heartbeat
    );


    ws.on(
      'message',
      (raw) => {

        let data;


        try {

          data =
            JSON.parse(
              raw.toString()
            );

        } catch {

          return;

        }


        // =========================
        // DISPOSITIVOS PRÓXIMOS
        // =========================

        if (data.type === 'register_device') {
          const newDeviceId =
            String(
              data.deviceId ||
              ''
            )
              .slice(
                0,
                80
              );

          if (!newDeviceId) {
            return;
          }

          // Se o mesmo navegador reconectar/recarregar,
          // substitui a conexão antiga em vez de listar
          // o mesmo aparelho várias vezes.
          wss.clients.forEach(
            (client) => {
              if (
                client !== ws &&
                client.deviceId === newDeviceId &&
                client.readyState === WebSocket.OPEN
              ) {
                client.available =
                  false;

                try {
                  client.close(
                    4001,
                    'Conexão substituída'
                  );
                } catch {}
              }
            }
          );

          ws.deviceId =
            newDeviceId;

          ws.deviceName =
            String(
              data.deviceName ||
              'Dispositivo'
            )
              .slice(
                0,
                80
              );

          ws.deviceType =
            String(
              data.deviceType ||
              'device'
            )
              .slice(
                0,
                30
              );

          ws.registeredAt =
            Date.now();

          ws.lastSeen =
            Date.now();

          ws.available =
            data.available !==
              false &&
            !ws.activeRoom;

          broadcastNearby(
            ws.networkKey
          );

          return;
        }

        if (
          data.type ===
          'presence_ping'
        ) {

          if (
            !ws.deviceId ||
            data.deviceId !==
              ws.deviceId
          ) {

            return;

          }


          ws.lastSeen =
            Date.now();


          ws.available =
            data.available !==
              false &&
            !ws.activeRoom;


          return;

        }


        if (data.type === 'get_nearby') {
          if (!ws.deviceId) {
            return;
          }

          ws.lastSeen =
            Date.now();

          sendNearbyDevices(
            ws
          );

          return;
        }

        if (data.type === 'connection_request') {
          const target = findDevice(data.targetId);

          if (
            !target ||
            target === ws ||
            !ws.available ||
            !target.available ||
            ws.activeRoom ||
            target.activeRoom ||
            target.networkKey !== ws.networkKey
          ) {
            safeSend(ws, { type: 'connection_unavailable' });
            sendNearbyDevices(ws);
            return;
          }

          safeSend(target, {
            type: 'connection_request',
            requesterId: ws.deviceId,
            requesterName: ws.deviceName
          });

          return;
        }

        if (data.type === 'connection_response') {
          const requester = findDevice(data.requesterId);

          if (!requester) return;

          if (!data.accepted) {
            safeSend(requester, {
              type: 'connection_rejected',
              deviceName: ws.deviceName
            });
            return;
          }

          if (
            !requester.available ||
            !ws.available ||
            requester.activeRoom ||
            ws.activeRoom ||
            requester.networkKey !== ws.networkKey
          ) {
            safeSend(requester, { type: 'connection_unavailable' });
            return;
          }

          createDirectRoom(requester, ws);
          return;
        }

        // =========================
        // CRIAR SALA
        // =========================

        if (
          data.type ===
          'create_room'
        ) {

          const roomId =
            data.roomId;


          if (!roomId) {
            return;
          }


          // Limpa QR anterior
          // deste mesmo dispositivo

          cleanupOwnerPendingRooms(
            ws
          );


          // Sala expira após 70s
          // se ninguém entrar

          const timer =
            setTimeout(
              () => {

                const room =
                  rooms.get(
                    roomId
                  );


                if (
                  room &&
                  !room.paired
                ) {

                  rooms.delete(
                    roomId
                  );

                }

              },

              70000
            );


          // Cria a sala

          rooms.set(
            roomId,
            {

              owner: ws,

              clients:
                new Set([ws]),

              paired:
                false,

              timer

            }
          );


          // IMPORTANTE:
          // só agora avisamos
          // o navegador que o QR
          // pode ser exibido

          safeSend(
            ws,
            {

              type:
                'room_created',

              roomId

            }
          );


          return;

        }


        // =========================
        // ENTRAR NA SALA
        // =========================

        if (
          data.type ===
          'join_room'
        ) {

          const roomId =
            data.roomId;


          const room =
            rooms.get(
              roomId
            );


          if (
            !room ||
            room.paired
          ) {

            safeSend(
              ws,
              {

                type:
                  'error',

                message:
                  'QR Code expirado ou inválido.'

              }
            );


            return;

          }


          clearTimeout(
            room.timer
          );


          room.clients.add(
            ws
          );


          room.paired =
            true;


          room.owner.activeRoom =
            roomId;


          ws.activeRoom =
            roomId;


          room.owner.available = false;
          ws.available = false;

          broadcastNearby(room.owner.networkKey);
          if (ws.networkKey !== room.owner.networkKey) {
            broadcastNearby(ws.networkKey);
          }


          cleanupOwnerPendingRooms(
            room.owner,
            roomId
          );


          // Avisa os dois
          // dispositivos

          room.clients.forEach(
            (client) => {

              safeSend(
                client,
                {

                  type:
                    'connected',

                  roomId

                }
              );

            }
          );


          return;

        }


        // =========================
        // PRECISA ESTAR CONECTADO
        // =========================

        const roomId =
          ws.activeRoom;


        if (!roomId) {
          return;
        }


        const room =
          rooms.get(
            roomId
          );


        if (
          !room ||
          !room.paired
        ) {

          return;

        }


        // =========================
        // DESCONECTAR
        // =========================

        if (
          data.type ===
          'end_session'
        ) {

          room.clients.forEach(
            (client) => {

              safeSend(
                client,
                {

                  type:
                    'session_ended'

                }
              );

            }
          );


          setTimeout(
            () => {

              destroyRoom(
                roomId,
                true
              );

            },

            80
          );


          return;

        }


        // =========================
        // REPASSAR DADOS
        // =========================

        room.clients.forEach(
          (client) => {

            if (
              client !== ws
            ) {

              safeSend(
                client,
                data
              );

            }

          }
        );

      }
    );


    // =========================
    // FECHOU / CAIU
    // =========================

    ws.on(
      'close',
      () => {

        ws.available =
          false;


        const roomId =
          ws.activeRoom;


        if (
          roomId &&
          rooms.has(roomId)
        ) {

          const room =
            rooms.get(
              roomId
            );


          room.clients.forEach(
            (client) => {

              if (
                client !== ws
              ) {

                safeSend(
                  client,
                  {

                    type:
                      'peer_disconnected'

                  }
                );

              }

            }
          );


          destroyRoom(
            roomId
          );

        }


        // Remove também
        // qualquer QR pendente

        cleanupOwnerPendingRooms(
          ws
        );

        broadcastNearby(ws.networkKey);

      }
    );

  }
);


// =========================
// LIMPAR PRESENÇA EXPIRADA
// =========================

const presenceCleanupInterval =
  setInterval(
    () => {

      const now =
        Date.now();


      const affectedNetworks =
        new Set();


      wss.clients.forEach(
        (ws) => {

          if (
            ws.deviceId &&
            ws.available &&
            !ws.activeRoom &&
            (
              !ws.lastSeen ||
              now -
                ws.lastSeen >=
                12000
            )
          ) {

            ws.available =
              false;


            affectedNetworks.add(
              ws.networkKey
            );

          }

        }
      );


      affectedNetworks.forEach(
        (networkKey) => {

          broadcastNearby(
            networkKey
          );

        }
      );

    },

    4000
  );


// =========================
// DETECTAR QUEDA DE CONEXÃO
// =========================

const heartbeatInterval =
  setInterval(
    () => {

      wss.clients.forEach(
        (ws) => {

          if (
            ws.isAlive === false
          ) {

            return ws.terminate();

          }


          ws.isAlive =
            false;


          ws.ping();

        }
      );

    },

    6000
  );


wss.on(
  'close',
  () => {

    clearInterval(
      heartbeatInterval
    );


    clearInterval(
      presenceCleanupInterval
    );

  }
);


// =========================
// SERVIDOR
// =========================

const PORT =
  process.env.PORT ||
  3000;


server.listen(
  PORT,
  () => {

    console.log(
      `Ponte Virtual ativa na porta ${PORT}`
    );

  }
);
