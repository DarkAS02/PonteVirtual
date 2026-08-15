const WS_URL =
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`;

const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const urlParams =
  new URLSearchParams(window.location.search);

let targetRoom =
  urlParams.get('room');

let socket = null;

let currentRoomId = null;

let qrInterval = null;
let timerCountdown = 60;
let progressInterval = null;

let pendingFile = null;

let html5QrScanner = null;


// =========================
// ELEMENTOS
// =========================

const screenConnect =
  document.getElementById('screen-connect');

const screenChat =
  document.getElementById('screen-chat');

const pcView =
  document.getElementById('pc-view');

const mobileView =
  document.getElementById('mobile-view');

const qrcodeContainer =
  document.getElementById('qrcode');

const qrProgress =
  document.getElementById('qr-progress');

const timerText =
  document.getElementById('timer-text');

const chatFeed =
  document.getElementById('chat-feed');

const mainInput =
  document.getElementById('main-input');

const btnSend =
  document.getElementById('btn-send');

const btnDestroy =
  document.getElementById('btn-destroy');

const btnOpenScanner =
  document.getElementById('btn-open-scanner');

const btnGenerateQR =
  document.getElementById('btn-generate-qr');

const mobileQrContainer =
  document.getElementById('mobile-qr-container');

const mobileQrcode =
  document.getElementById('mobile-qrcode');

const readerContainer =
  document.getElementById('reader-container');

const btnCloseScanner =
  document.getElementById('btn-close-scanner');

const attachFile =
  document.getElementById('attach-file');

const attachPhoto =
  document.getElementById('attach-photo');

const btnToggleAttach =
  document.getElementById('btn-toggle-attach');

const attachMenu =
  document.getElementById('attach-menu');

const modalConfirm =
  document.getElementById('modal-confirm');

const modalText =
  document.getElementById('modal-text');

const btnModalAccept =
  document.getElementById('btn-modal-accept');

const btnModalReject =
  document.getElementById('btn-modal-reject');


// =========================
// WEBSOCKET
// =========================

function connectSocket() {

  socket =
    new WebSocket(WS_URL);

  socket.onopen = () => {

    if (targetRoom) {

      socket.send(
        JSON.stringify({
          type: 'join_room',
          roomId: targetRoom
        })
      );

    } else if (!isMobile) {

      startQRCycle();

    }

  };


  socket.onmessage = (event) => {

    const data =
      JSON.parse(event.data);


    if (data.type === 'connected') {

      stopQRCycle();

      activateChat();

    }


    if (data.type === 'message') {

      renderBubble(
        data.content,
        'other',
        data.contentType
      );

    }


    if (data.type === 'file_offer') {

      promptDownload(data);

    }


    if (data.type === 'error') {

      alert(data.message);

      hardReset();

    }


    if (data.type === 'peer_disconnected') {

      alert(
        'O outro dispositivo desconectou. Encerrando sessão por segurança.'
      );

      hardReset();

    }

  };


  socket.onclose = () => {

    hardReset();

  };

}


// =========================
// QR CODE DO PC
// =========================

function startQRCycle() {

  generateNewQR();


  qrInterval =
    setInterval(() => {

      generateNewQR();

    }, 60000);


  timerCountdown = 60;


  progressInterval =
    setInterval(() => {

      timerCountdown--;


      if (timerText) {

        timerText.innerText =
          `Expira em: ${timerCountdown}s`;

      }


      if (qrProgress) {

        qrProgress.style.width =
          `${(timerCountdown / 60) * 100}%`;

      }


      if (timerCountdown <= 0) {

        timerCountdown = 60;

      }

    }, 1000);

}


function stopQRCycle() {

  clearInterval(qrInterval);

  clearInterval(progressInterval);

}


function generateNewQR() {

  currentRoomId =
    'brg-' +
    crypto.randomUUID().substring(0, 8);


  qrcodeContainer.innerHTML = '';


  const joinUrl =
    `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;


  new QRCode(
    qrcodeContainer,
    {
      text: joinUrl,
      width: 170,
      height: 170,
      colorDark: '#04121a',
      colorLight: '#ffffff'
    }
  );


  socket.send(
    JSON.stringify({
      type: 'create_room',
      roomId: currentRoomId
    })
  );


  timerCountdown = 60;

}


// =========================
// QR CODE DO CELULAR
// =========================

if (btnGenerateQR) {

  btnGenerateQR.addEventListener('click', () => {

    // Verifica se o servidor está conectado
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      alert('A conexão com o servidor ainda não está pronta. Tente novamente em alguns segundos.');
      return;
    }

    // Verifica se a biblioteca de QR Code carregou
    if (typeof QRCode === 'undefined') {
      alert('Não foi possível carregar o gerador de QR Code.');
      return;
    }

    try {

      // Cria uma sala temporária
      currentRoomId =
        'brg-' + crypto.randomUUID().substring(0, 8);

      // Limpa QR anterior
      mobileQrcode.innerHTML = '';

      // Cria o endereço que o outro celular deverá acessar
      const joinUrl =
        `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;

      // Gera o QR Code
      new QRCode(mobileQrcode, {
        text: joinUrl,
        width: 170,
        height: 170,
        colorDark: '#04121a',
        colorLight: '#ffffff'
      });

      // Cria a sala no servidor
      socket.send(JSON.stringify({
        type: 'create_room',
        roomId: currentRoomId
      }));

      // Mostra o QR
      mobileQrContainer.classList.remove('hidden');

      // Esconde o scanner caso esteja aberto
      readerContainer.classList.add('hidden');

    } catch (error) {

      console.error('Erro ao gerar QR Code:', error);

      alert('Ocorreu um erro ao gerar o QR Code.');

    }

  });

}
// =========================
// CHAT
// =========================

function activateChat() {

  screenConnect.classList.add('hidden');

  screenChat.classList.remove('hidden');

}


// =========================
// ENVIO DE TEXTO
// =========================

function sendContent(
  text,
  type = 'text'
) {

  if (!text.trim()) {

    return;

  }


  socket.send(
    JSON.stringify({
      type: 'message',
      content: text,
      contentType: type
    })
  );


  renderBubble(
    text,
    'me',
    type
  );


  mainInput.value = '';

}


btnSend.addEventListener(
  'click',
  () => {

    sendContent(
      mainInput.value
    );

  }
);


mainInput.addEventListener(
  'keypress',
  (event) => {

    if (event.key === 'Enter') {

      sendContent(
        mainInput.value
      );

    }

  }
);


// =========================
// BOLHAS DO CHAT
// =========================

function renderBubble(
  content,
  sender,
  type
) {

  const bubble =
    document.createElement('div');


  bubble.className =
    `msg ${sender}`;


  if (type === 'code') {

    bubble.innerHTML = `
      <div class="code-block">
        ${escapeHtml(content)}
      </div>

      <button
        class="btn-copy"
        onclick="copyText('${escapeHtml(content)}')"
      >
        Copiar Código
      </button>
    `;

  } else {

    bubble.innerHTML = `
      <div>
        ${escapeHtml(content)}
      </div>

      <button
        class="btn-copy"
        onclick="copyText('${escapeHtml(content)}')"
      >
        Copiar
      </button>
    `;

  }


  chatFeed.appendChild(
    bubble
  );


  chatFeed.scrollTop =
    chatFeed.scrollHeight;

}


window.copyText =
  (text) => {

    navigator.clipboard.writeText(
      text
    );

  };


// =========================
// ARQUIVOS
// =========================

function handleFileUpload(file) {

  if (!file) {

    return;

  }


  const reader =
    new FileReader();


  reader.onload = () => {

    socket.send(
      JSON.stringify({
        type: 'file_offer',
        name: file.name,
        size:
          (file.size / 1024).toFixed(1) +
          ' KB',
        data: reader.result
      })
    );


    renderBubble(
      `Enviou: ${file.name}`,
      'me',
      'text'
    );

  };


  reader.readAsDataURL(
    file
  );

}


attachFile.addEventListener(
  'change',
  (event) => {

    handleFileUpload(
      event.target.files[0]
    );

  }
);


attachPhoto.addEventListener(
  'change',
  (event) => {

    handleFileUpload(
      event.target.files[0]
    );

  }
);


// =========================
// DOWNLOAD
// =========================

function promptDownload(fileOffer) {

  pendingFile =
    fileOffer;


  modalText.innerText =
    `Deseja baixar "${fileOffer.name}" (${fileOffer.size})?`;


  modalConfirm.classList.remove(
    'hidden'
  );

}


btnModalAccept.addEventListener(
  'click',
  () => {

    if (pendingFile) {

      const a =
        document.createElement('a');


      a.href =
        pendingFile.data;


      a.download =
        pendingFile.name;


      a.click();

    }


    modalConfirm.classList.add(
      'hidden'
    );


    pendingFile = null;

  }
);


btnModalReject.addEventListener(
  'click',
  () => {

    modalConfirm.classList.add(
      'hidden'
    );


    pendingFile = null;

  }
);


// =========================
// SCANNER DE QR
// =========================

if (btnOpenScanner) {

  btnOpenScanner.addEventListener(
    'click',
    async () => {

      mobileQrContainer.classList.add(
        'hidden'
      );


      readerContainer.classList.remove(
        'hidden'
      );


      try {

        html5QrScanner =
          new Html5Qrcode(
            'reader'
          );


        await html5QrScanner.start(

          {
            facingMode:
              'environment'
          },

          {
            fps: 10,
            qrbox: 250
          },

          (decodedText) => {

            html5QrScanner.stop();

            window.location.href =
              decodedText;

          },

          () => {}

        );

      } catch (error) {

        console.error(
          'Erro ao abrir câmera:',
          error
        );


        alert(
          'Não foi possível abrir a câmera. Durante o teste local, isso pode acontecer porque o site está usando HTTP em vez de HTTPS.'
        );


        readerContainer.classList.add(
          'hidden'
        );

      }

    }
  );


  btnCloseScanner.addEventListener(
    'click',
    async () => {

      try {

        if (html5QrScanner) {

          await html5QrScanner.stop();

          await html5QrScanner.clear();

          html5QrScanner = null;

        }

      } catch (error) {

        console.log(
          'Scanner já estava parado.'
        );

      }


      readerContainer.classList.add(
        'hidden'
      );

    }
  );

}


// =========================
// MENU DE ANEXOS
// =========================

btnToggleAttach.addEventListener(
  'click',
  () => {

    attachMenu.classList.toggle(
      'hidden'
    );

  }
);


// =========================
// RESET
// =========================

function hardReset() {

  pendingFile = null;

  currentRoomId = null;


  if (chatFeed) {

    chatFeed.innerHTML = '';

  }


  window.location.href =
    window.location.origin +
    window.location.pathname;

}


btnDestroy.addEventListener(
  'click',
  () => {

    if (socket) {

      socket.close();

    }


    hardReset();

  }
);


// =========================
// SEGURANÇA DE TEXTO
// =========================

function escapeHtml(str) {

  return str.replace(
    /[&<>"']/g,

    (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]

  );

}


// =========================
// INICIALIZAÇÃO
// =========================

window.addEventListener(
  'DOMContentLoaded',
  () => {

    if (
      isMobile &&
      !targetRoom
    ) {

      pcView.classList.add(
        'hidden'
      );


      mobileView.classList.remove(
        'hidden'
      );

    }


    connectSocket();

  }
);