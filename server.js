const express = require('express');
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(
  express.static(
    path.join(__dirname, 'Public')
  )
);


// =========================
// SALAS
// =========================

const rooms = new Map();


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
  (ws) => {

    ws.activeRoom = null;

    ws.isAlive = true;


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

      }
    );

  }
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
