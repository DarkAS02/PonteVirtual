// =========================
// CONFIGURAÇÃO
// =========================

const WS_URL =
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`;

const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const params =
  new URLSearchParams(window.location.search);

const targetRoom =
  params.get('room');


// =========================
// ESTADO
// =========================

let socket = null;
let currentRoomId = null;

let pcQrInterval = null;
let pcTimerInterval = null;

let mobileQrInterval = null;
let mobileTimerInterval = null;

let scanner = null;
let scanningLocked = false;

let mediaRecorder = null;
let recordingStream = null;
let audioChunks = [];

let toastTimer = null;


// fila para vários arquivos recebidos
const incomingQueue = [];

let currentIncoming = null;


// arquivos enviados ficam na memória
// enquanto a sessão existir
const sentTransfers =
  new Map();


// cards existentes na tela
const transferCards =
  new Map();


// =========================
// ELEMENTOS
// =========================

const screenConnect =
  document.getElementById('screen-connect');

const screenApp =
  document.getElementById('screen-app');


const pcView =
  document.getElementById('pc-view');

const mobileView =
  document.getElementById('mobile-view');

const scannerView =
  document.getElementById('scanner-view');

const mobileQrView =
  document.getElementById('mobile-qr-view');

const joiningView =
  document.getElementById('joining-view');


const qrcodeContainer =
  document.getElementById('qrcode');

const qrProgress =
  document.getElementById('qr-progress');

const timerText =
  document.getElementById('timer-text');


const mobileQrcode =
  document.getElementById('mobile-qrcode');

const mobileQrProgress =
  document.getElementById('mobile-qr-progress');

const mobileTimerText =
  document.getElementById('mobile-timer-text');


const btnOpenScanner =
  document.getElementById('btn-open-scanner');

const btnCloseScanner =
  document.getElementById('btn-close-scanner');

const btnGenerateQR =
  document.getElementById('btn-generate-qr');

const btnBackMobileQR =
  document.getElementById('btn-back-mobile-qr');

const btnDestroy =
  document.getElementById('btn-destroy');


const tabs =
  document.querySelectorAll('.tab');

const panels =
  document.querySelectorAll('.tab-panel');


const dropZone =
  document.getElementById('drop-zone');

const selectButton =
  document.querySelector('.select-button');


const attachFile =
  document.getElementById('attach-file');

const attachPhoto =
  document.getElementById('attach-photo');

const attachAudio =
  document.getElementById('attach-audio');


const mediaFeed =
  document.getElementById('media-feed');

const textFeed =
  document.getElementById('text-feed');

const audioFeed =
  document.getElementById('audio-feed');


const textInput =
  document.getElementById('text-input');

const btnSendText =
  document.getElementById('btn-send-text');


const btnRecord =
  document.getElementById('btn-record');

const recordIcon =
  document.getElementById('record-icon');

const recordText =
  document.getElementById('record-text');


const modal =
  document.getElementById('modal-confirm');

const modalText =
  document.getElementById('modal-text');

const btnModalAccept =
  document.getElementById('btn-modal-accept');

const btnModalReject =
  document.getElementById('btn-modal-reject');


const toast =
  document.getElementById('toast');


// =========================
// GERAR IDs
// =========================

function randomId(prefix = 'id') {

  if (
    window.crypto &&
    typeof crypto.randomUUID === 'function'
  ) {

    return (
      `${prefix}-` +
      crypto
        .randomUUID()
        .replaceAll('-', '')
        .substring(0, 16)
    );

  }

  return (
    `${prefix}-` +
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 9)
  );
}


function createRoomId() {
  return randomId('brg');
}


function createTransferId() {
  return randomId('trf');
}


// =========================
// WEBSOCKET
// =========================

function connectSocket() {

  socket =
    new WebSocket(WS_URL);


  socket.onopen = () => {

    if (targetRoom) {

      showConnectView(
        joiningView
      );

      socket.send(
        JSON.stringify({
          type: 'join_room',
          roomId: targetRoom
        })
      );

      return;
    }


    if (isMobile) {

      showConnectView(
        mobileView
      );

    } else {

      showConnectView(
        pcView
      );

      startPcQrCycle();
    }

  };


  socket.onmessage = (event) => {

    let data;

    try {

      data =
        JSON.parse(event.data);

    } catch {

      return;
    }


    if (data.type === 'connected') {

      stopQrTimers();

      stopScanner();

      activateApp();

      showToast(
        'Dispositivo conectado ✓'
      );

      return;
    }


    if (data.type === 'message') {

      addTextMessage(
        data.content,
        'other'
      );

      return;
    }


    if (data.type === 'file_offer') {

      queueIncomingTransfer(
        data
      );

      return;
    }


    if (
      data.type ===
      'transfer_status'
    ) {

      updateTransferStatus(
        data.transferId,
        data.status
      );

      return;
    }


    if (
      data.type === 'session_ended' ||
      data.type === 'peer_disconnected'
    ) {

      showToast(
        'Sessão encerrada'
      );

      setTimeout(
        goHome,
        350
      );

      return;
    }


    if (data.type === 'error') {

      showToast(
        data.message
      );

      setTimeout(
        goHome,
        1200
      );
    }

  };


  socket.onerror = () => {

    showToast(
      'Erro de conexão com o servidor'
    );

  };


  socket.onclose = () => {

    stopQrTimers();

    if (
      !screenApp.classList.contains(
        'hidden'
      )
    ) {

      setTimeout(
        goHome,
        250
      );

    }

  };

}


// =========================
// TELAS
// =========================

function hideConnectViews() {

  pcView.classList.add(
    'hidden'
  );

  mobileView.classList.add(
    'hidden'
  );

  scannerView.classList.add(
    'hidden'
  );

  mobileQrView.classList.add(
    'hidden'
  );

  joiningView.classList.add(
    'hidden'
  );

}


function showConnectView(view) {

  hideConnectViews();

  view.classList.remove(
    'hidden'
  );

}


function activateApp() {

  screenConnect.classList.add(
    'hidden'
  );

  screenApp.classList.remove(
    'hidden'
  );

}


// =========================
// QR CODE PC
// =========================

function startPcQrCycle() {

  generatePcQr();

  clearInterval(
    pcQrInterval
  );


  pcQrInterval =
    setInterval(
      generatePcQr,
      50000
    );

}


function generatePcQr() {

  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }


  currentRoomId =
    createRoomId();


  const joinUrl =
    `${window.location.origin}` +
    `${window.location.pathname}` +
    `?room=${currentRoomId}`;


  qrcodeContainer.innerHTML =
    '';


  new QRCode(
    qrcodeContainer,
    {
      text: joinUrl,
      width: 170,
      height: 170,

      colorDark:
        '#04121a',

      colorLight:
        '#ffffff',

      correctLevel:
        QRCode.CorrectLevel.M
    }
  );


  socket.send(
    JSON.stringify({
      type: 'create_room',
      roomId: currentRoomId
    })
  );


  startCountdown(
    timerText,
    qrProgress,
    'pc'
  );

}


// =========================
// GERAR QR NO CELULAR
// =========================

btnGenerateQR.addEventListener(
  'click',
  () => {

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {

      showToast(
        'Servidor ainda conectando...'
      );

      return;
    }


    showConnectView(
      mobileQrView
    );


    generateMobileQr();


    clearInterval(
      mobileQrInterval
    );


    mobileQrInterval =
      setInterval(
        generateMobileQr,
        50000
      );

  }
);


function generateMobileQr() {

  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {
    return;
  }


  currentRoomId =
    createRoomId();


  const joinUrl =
    `${window.location.origin}` +
    `${window.location.pathname}` +
    `?room=${currentRoomId}`;


  mobileQrcode.innerHTML =
    '';


  new QRCode(
    mobileQrcode,
    {
      text: joinUrl,
      width: 170,
      height: 170,

      colorDark:
        '#04121a',

      colorLight:
        '#ffffff',

      correctLevel:
        QRCode.CorrectLevel.M
    }
  );


  socket.send(
    JSON.stringify({
      type: 'create_room',
      roomId: currentRoomId
    })
  );


  startCountdown(
    mobileTimerText,
    mobileQrProgress,
    'mobile'
  );

}


btnBackMobileQR.addEventListener(
  'click',
  () => {

    clearInterval(
      mobileQrInterval
    );

    clearInterval(
      mobileTimerInterval
    );


    showConnectView(
      mobileView
    );

  }
);


// =========================
// CONTADOR DO QR
// =========================

function startCountdown(
  textElement,
  progressElement,
  type
) {

  let seconds = 50;


  if (type === 'pc') {

    clearInterval(
      pcTimerInterval
    );

  } else {

    clearInterval(
      mobileTimerInterval
    );

  }


  textElement.textContent =
    `Expira em ${seconds}s`;


  progressElement.style.width =
    '100%';


  const interval =
    setInterval(
      () => {

        seconds--;


        textElement.textContent =
          `Expira em ${Math.max(
            seconds,
            0
          )}s`;


        progressElement.style.width =
          `${
            (
              Math.max(
                seconds,
                0
              ) / 50
            ) * 100
          }%`;


        if (seconds <= 0) {

          clearInterval(
            interval
          );

        }

      },

      1000
    );


  if (type === 'pc') {

    pcTimerInterval =
      interval;

  } else {

    mobileTimerInterval =
      interval;

  }

}


// =========================
// SCANNER
// =========================

btnOpenScanner.addEventListener(
  'click',

  async () => {

    showConnectView(
      scannerView
    );


    scanningLocked =
      false;


    try {

      scanner =
        new Html5Qrcode(
          'reader'
        );


      await scanner.start(

        {
          facingMode: {
            exact: 'environment'
          }
        },


        {
          fps: 18,

          qrbox:
            (
              width,
              height
            ) => {

              const size =
                Math.floor(
                  Math.min(
                    width,
                    height
                  ) * 0.82
                );


              return {
                width: size,
                height: size
              };

            },

          disableFlip:
            false
        },


        async (
          decodedText
        ) => {

          if (
            scanningLocked
          ) {
            return;
          }


          let url;


          try {

            url =
              new URL(
                decodedText
              );

          } catch {

            return;
          }


          if (
            url.origin !==
              window.location.origin ||
            !url.searchParams.get(
              'room'
            )
          ) {

            showToast(
              'QR Code inválido'
            );

            return;
          }


          scanningLocked =
            true;


          await stopScanner();


          window.location.href =
            url.href;

        },


        () => {}

      );


      setTimeout(
        improveRunningCamera,
        600
      );


    } catch (error) {

      console.error(
        'Erro ao abrir câmera:',
        error
      );


      showToast(
        'Não foi possível abrir a câmera'
      );


      showConnectView(
        mobileView
      );

    }

  }
);


btnCloseScanner.addEventListener(
  'click',

  async () => {

    await stopScanner();


    showConnectView(
      mobileView
    );

  }
);


// tenta melhorar a câmera
// quando o aparelho permitir

async function improveRunningCamera() {

  if (!scanner) return;


  try {

    const capabilities =
      scanner
        .getRunningTrackCapabilities();


    const constraints = {
      advanced: []
    };


    if (
      capabilities.focusMode
    ) {

      constraints.advanced.push({
        focusMode:
          'continuous'
      });

    }


    if (
      capabilities.zoom
    ) {

      const min =
        capabilities.zoom.min ?? 1;


      const max =
        capabilities.zoom.max ?? 1;


      const desired =
        Math.min(
          max,
          Math.max(
            min,
            1.25
          )
        );


      constraints.advanced.push({
        zoom: desired
      });

    }


    if (
      capabilities.width &&
      capabilities.height
    ) {

      constraints.width = {
        ideal: 1920
      };


      constraints.height = {
        ideal: 1080
      };

    }


    if (
      constraints.advanced.length ||
      constraints.width
    ) {

      await scanner
        .applyVideoConstraints(
          constraints
        );

    }

  } catch (error) {

    console.log(
      'Ajustes avançados da câmera não disponíveis.'
    );

  }

}


async function stopScanner() {

  if (!scanner) return;


  try {

    await scanner.stop();

  } catch {}


  try {

    scanner.clear();

  } catch {}


  scanner = null;

}


// =========================
// ABAS
// =========================

tabs.forEach(
  (tab) => {

    tab.addEventListener(
      'click',
      () => {

        tabs.forEach(
          (item) => {

            item.classList.remove(
              'active'
            );

          }
        );


        panels.forEach(
          (panel) => {

            panel.classList.remove(
              'active'
            );

          }
        );


        tab.classList.add(
          'active'
        );


        document
          .getElementById(
            `tab-${tab.dataset.tab}`
          )
          .classList.add(
            'active'
          );

      }
    );

  }
);


// =========================
// TEXTO
// =========================

btnSendText.addEventListener(
  'click',
  sendText
);


textInput.addEventListener(
  'keydown',
  (event) => {

    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendText();

    }

  }
);


function sendText() {

  const content =
    textInput.value.trim();


  if (!content) return;


  if (!socketReady()) {

    showToast(
      'Conexão indisponível'
    );

    return;
  }


  socket.send(
    JSON.stringify({
      type: 'message',
      content,
      contentType: 'text'
    })
  );


  addTextMessage(
    content,
    'me'
  );


  textInput.value =
    '';


  showToast(
    'Texto enviado ✓',
    false
  );

}


function addTextMessage(
  content,
  sender
) {

  const message =
    document.createElement(
      'div'
    );


  message.className =
    `chat-message ${sender}`;


  const text =
    document.createElement(
      'div'
    );


  text.className =
    'message-text';


  text.textContent =
    content;


  const actions =
    document.createElement(
      'div'
    );


  actions.className =
    'message-actions';


  const copy =
    document.createElement(
      'button'
    );


  copy.className =
    'copy-button';


  copy.textContent =
    'Copiar';


  copy.addEventListener(
    'click',

    async () => {

      try {

        await navigator
          .clipboard
          .writeText(
            content
          );


        copy.textContent =
          '✓ Copiado';


        copy.classList.add(
          'copied'
        );


        showToast(
          'Copiado para a área de transferência'
        );


        setTimeout(
          () => {

            copy.textContent =
              'Copiar';


            copy.classList.remove(
              'copied'
            );

          },

          1600
        );


      } catch {

        showToast(
          'Não foi possível copiar'
        );

      }

    }
  );


  actions.appendChild(
    copy
  );


  message.append(
    text,
    actions
  );


  textFeed.appendChild(
    message
  );


  textFeed.scrollTop =
    textFeed.scrollHeight;

}


// =========================
// SELEÇÃO MÚLTIPLA
// =========================

selectButton.addEventListener(
  'click',
  (event) => {

    event.preventDefault();
    event.stopPropagation();

    attachFile.click();

  }
);


attachFile.addEventListener(
  'change',
  (event) => {

    const files =
      Array.from(
        event.target.files
      );


    sendFiles(
      files
    );


    event.target.value =
      '';

  }
);


attachPhoto.addEventListener(
  'change',
  (event) => {

    const files =
      Array.from(
        event.target.files
      );


    sendFiles(
      files
    );


    event.target.value =
      '';

  }
);


attachAudio.addEventListener(
  'change',
  (event) => {

    const files =
      Array.from(
        event.target.files
      );


    sendFiles(
      files
    );


    event.target.value =
      '';

  }
);


function sendFiles(files) {

  if (!files.length) {
    return;
  }


  files.forEach(
    sendFile
  );


  if (
    files.length > 1
  ) {

    showToast(
      `${files.length} itens selecionados`,
      false
    );

  }

}


// =========================
// ENVIO DE ARQUIVO
// =========================

function sendFile(file) {

  // temporário para o protótipo
  const maxSize =
    6 * 1024 * 1024;


  if (
    file.size > maxSize
  ) {

    showToast(
      `"${file.name}" passou do limite de 6 MB`
    );

    return;
  }


  if (!socketReady()) {

    showToast(
      'Conexão indisponível'
    );

    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    () => {

      const transferId =
        createTransferId();


      const transfer = {

        type:
          'file_offer',

        transferId,

        name:
          file.name,

        size:
          formatBytes(
            file.size
          ),

        bytes:
          file.size,

        mime:
          file.type,

        category:
          fileCategory(
            file
          ),

        data:
          reader.result

      };


      sentTransfers.set(
        transferId,
        transfer
      );


      socket.send(
        JSON.stringify(
          transfer
        )
      );


      addFileCard(
        transfer,
        'me',
        'pending'
      );

    };


  reader.readAsDataURL(
    file
  );

}


// =========================
// ARRASTAR ARQUIVOS
// =========================

[
  'dragenter',
  'dragover'
].forEach(
  (eventName) => {

    dropZone.addEventListener(
      eventName,
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        dropZone.classList.add(
          'dragging'
        );

      }
    );

  }
);


[
  'dragleave',
  'drop'
].forEach(
  (eventName) => {

    dropZone.addEventListener(
      eventName,
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        dropZone.classList.remove(
          'dragging'
        );

      }
    );

  }
);


dropZone.addEventListener(
  'drop',
  (event) => {

    const files =
      Array.from(
        event.dataTransfer.files
      );


    sendFiles(
      files
    );

  }
);


// =========================
// FILA DE RECEBIMENTO
// =========================

function queueIncomingTransfer(
  file
) {

  incomingQueue.push(
    file
  );


  showNextIncoming();

}


function showNextIncoming() {

  if (
    currentIncoming ||
    !incomingQueue.length
  ) {
    return;
  }


  currentIncoming =
    incomingQueue.shift();


  modalText.textContent =
    `${currentIncoming.name} • ${currentIncoming.size}`;


  modal.classList.remove(
    'hidden'
  );

}


// =========================
// ACEITAR
// =========================

btnModalAccept.addEventListener(
  'click',
  () => {

    if (
      !currentIncoming
    ) {
      return;
    }


    const file =
      currentIncoming;


    downloadFile(
      file
    );


    addFileCard(
      file,
      'other',
      'accepted'
    );


    sendTransferStatus(
      file.transferId,
      'accepted'
    );


    modal.classList.add(
      'hidden'
    );


    currentIncoming =
      null;


    showToast(
      '✓ Download iniciado'
    );


    showNextIncoming();

  }
);


// =========================
// RECUSAR
// =========================

btnModalReject.addEventListener(
  'click',
  () => {

    if (
      !currentIncoming
    ) {
      return;
    }


    const file =
      currentIncoming;


    addFileCard(
      file,
      'other',
      'rejected'
    );


    sendTransferStatus(
      file.transferId,
      'rejected'
    );


    modal.classList.add(
      'hidden'
    );


    currentIncoming =
      null;


    showToast(
      'Arquivo recusado',
      false
    );


    showNextIncoming();

  }
);


// =========================
// AVISAR STATUS
// =========================

function sendTransferStatus(
  transferId,
  status
) {

  if (!socketReady()) {
    return;
  }


  socket.send(
    JSON.stringify({
      type:
        'transfer_status',

      transferId,

      status
    })
  );

}


// =========================
// RECEBER STATUS
// =========================

function updateTransferStatus(
  transferId,
  status
) {

  const card =
    transferCards.get(
      transferId
    );


  if (!card) {
    return;
  }


  setCardStatus(
    card,
    status
  );


  if (
    status === 'accepted'
  ) {

    showToast(
      'Arquivo recebido pelo outro dispositivo ✓'
    );

  }


  if (
    status === 'rejected'
  ) {

    showToast(
      'O outro dispositivo recusou o arquivo',
      false
    );

  }

}


// =========================
// REENVIAR
// =========================

function resendTransfer(
  transferId
) {

  const transfer =
    sentTransfers.get(
      transferId
    );


  if (!transfer) {

    showToast(
      'Esse arquivo não está mais disponível para reenvio'
    );

    return;
  }


  if (!socketReady()) {

    showToast(
      'Conexão indisponível'
    );

    return;
  }


  socket.send(
    JSON.stringify(
      transfer
    )
  );


  const card =
    transferCards.get(
      transferId
    );


  if (card) {

    setCardStatus(
      card,
      'pending'
    );

  }


  showToast(
    'Arquivo reenviado',
    false
  );

}


// =========================
// DOWNLOAD
// =========================

function downloadFile(file) {

  const link =
    document.createElement(
      'a'
    );


  link.href =
    file.data;


  link.download =
    file.name;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();

}


// =========================
// CRIAR CARD
// =========================

function addFileCard(
  file,
  sender,
  status
) {

  const category =
    file.category ||
    categoryFromMime(
      file.mime
    );


  const feed =
    category === 'audio'
      ? audioFeed
      : mediaFeed;


  const card =
    document.createElement(
      'div'
    );


  card.className =
    'file-card';


  card.dataset.transferId =
    file.transferId;


  const icon =
    document.createElement(
      'div'
    );


  icon.className =
    'file-card-icon';


  icon.innerHTML =
    iconForCategory(
      category
    );


  const main =
    document.createElement(
      'div'
    );


  main.className =
    'file-card-main';


  const titleRow =
    document.createElement(
      'div'
    );


  titleRow.className =
    'file-card-title-row';


  const title =
    document.createElement(
      'div'
    );


  title.className =
    'file-card-title';


  const strong =
    document.createElement(
      'strong'
    );


  strong.textContent =
    file.name;


  const detail =
    document.createElement(
      'small'
    );


  detail.textContent =
    file.size;


  title.append(
    strong,
    detail
  );


  const actions =
    document.createElement(
      'div'
    );


  actions.className =
    'file-card-actions';


  // LIXEIRA

  const deleteButton =
    document.createElement(
      'button'
    );


  deleteButton.className =
    'icon-button danger';


  deleteButton.title =
    'Remover do histórico';


  deleteButton.innerHTML =
    trashIcon();


  deleteButton.addEventListener(
    'click',
    () => {

      card.remove();


      transferCards.delete(
        file.transferId
      );


      if (
        sender === 'me'
      ) {

        sentTransfers.delete(
          file.transferId
        );

      }


      showToast(
        'Removido do histórico',
        false
      );

    }
  );


  actions.appendChild(
    deleteButton
  );


  titleRow.append(
    title,
    actions
  );


  main.appendChild(
    titleRow
  );


  // PREVIEW DE IMAGEM

  if (
    category === 'image' &&
    file.data
  ) {

    const preview =
      document.createElement(
        'img'
      );


    preview.src =
      file.data;


    preview.alt =
      file.name;


    preview.className =
      'file-preview';


    main.appendChild(
      preview
    );

  }


  // PLAYER DE ÁUDIO

  if (
    category === 'audio' &&
    file.data
  ) {

    const audio =
      document.createElement(
        'audio'
      );


    audio.controls =
      true;


    audio.src =
      file.data;


    main.appendChild(
      audio
    );

  }


  // STATUS

  const statusRow =
    document.createElement(
      'div'
    );


  statusRow.className =
    'transfer-status-row';


  const statusText =
    document.createElement(
      'span'
    );


  statusText.className =
    'transfer-status';


  // BOTÃO REENVIAR

  const retryButton =
    document.createElement(
      'button'
    );


  retryButton.className =
    'retry-button';


  retryButton.textContent =
    '↻ Reenviar';


  retryButton.addEventListener(
    'click',
    () => {

      resendTransfer(
        file.transferId
      );

    }
  );


  statusRow.append(
    statusText
  );


  if (
    sender === 'me'
  ) {

    statusRow.appendChild(
      retryButton
    );

  }


  main.appendChild(
    statusRow
  );


  card.append(
    icon,
    main
  );


  feed.prepend(
    card
  );


  transferCards.set(
    file.transferId,
    card
  );


  setCardStatus(
    card,
    status
  );


  return card;

}


// =========================
// ALTERAR STATUS DO CARD
// =========================

function setCardStatus(
  card,
  status
) {

  card.classList.remove(
    'pending',
    'accepted',
    'rejected'
  );


  card.classList.add(
    status
  );


  const statusText =
    card.querySelector(
      '.transfer-status'
    );


  if (!statusText) {
    return;
  }


  statusText.className =
    `transfer-status ${status}`;


  if (
    status === 'pending'
  ) {

    statusText.textContent =
      '◷ Aguardando resposta...';

  }


  if (
    status === 'accepted'
  ) {

    statusText.textContent =
      '✓ Recebido pelo outro dispositivo';

  }


  if (
    status === 'rejected'
  ) {

    statusText.textContent =
      '✕ Recusado';

  }

}


// =========================
// GRAVAÇÃO DE ÁUDIO
// =========================

btnRecord.addEventListener(
  'click',

  async () => {

    // se já estiver gravando,
    // apertar novamente para

    if (
      mediaRecorder &&
      mediaRecorder.state ===
        'recording'
    ) {

      mediaRecorder.stop();

      return;
    }


    try {

      recordingStream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: true
          });


      audioChunks =
        [];


      mediaRecorder =
        new MediaRecorder(
          recordingStream
        );


      mediaRecorder.ondataavailable =
        (event) => {

          if (
            event.data.size > 0
          ) {

            audioChunks.push(
              event.data
            );

          }

        };


      mediaRecorder.onstop =
        () => {

          const mime =
            mediaRecorder.mimeType ||
            'audio/webm';


          const blob =
            new Blob(
              audioChunks,
              {
                type: mime
              }
            );


          const file =
            new File(
              [blob],

              `audio-${Date.now()}.webm`,

              {
                type: mime
              }
            );


          if (
            recordingStream
          ) {

            recordingStream
              .getTracks()
              .forEach(
                (track) => {

                  track.stop();

                }
              );

          }


          recordingStream =
            null;


          btnRecord.classList.remove(
            'recording'
          );


          recordIcon.textContent =
            '●';


          recordText.textContent =
            'Gravar áudio';


          sendFile(
            file
          );

        };


      mediaRecorder.start();


      btnRecord.classList.add(
        'recording'
      );


      recordIcon.textContent =
        '■';


      recordText.textContent =
        'Parar gravação';


      showToast(
        'Gravação iniciada',
        false
      );


    } catch (error) {

      console.error(
        'Erro no microfone:',
        error
      );


      showToast(
        'Não foi possível acessar o microfone'
      );

    }

  }
);


// =========================
// UTILIDADES
// =========================

function socketReady() {

  return (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
  );

}


function fileCategory(file) {

  return categoryFromMime(
    file.type
  );

}


function categoryFromMime(
  mime = ''
) {

  if (
    mime.startsWith(
      'image/'
    )
  ) {

    return 'image';

  }


  if (
    mime.startsWith(
      'audio/'
    )
  ) {

    return 'audio';

  }


  if (
    mime.startsWith(
      'video/'
    )
  ) {

    return 'video';

  }


  return 'file';

}


function formatBytes(bytes) {

  if (
    bytes < 1024
  ) {

    return `${bytes} B`;

  }


  if (
    bytes <
    1024 * 1024
  ) {

    return (
      `${(bytes / 1024)
        .toFixed(1)} KB`
    );

  }


  return (
    `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`
  );

}


// =========================
// ÍCONES
// =========================

function iconForCategory(
  category
) {

  if (
    category === 'image'
  ) {

    return `
      <svg viewBox="0 0 24 24">
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
        />

        <circle
          cx="8.5"
          cy="9"
          r="1.5"
        />

        <path
          d="m5 17 4-4 3 3 2-2 5 5"
        />
      </svg>
    `;

  }


  if (
    category === 'audio'
  ) {

    return `
      <svg viewBox="0 0 24 24">
        <path
          d="M9 18V5l10-2v13"
        />

        <circle
          cx="6"
          cy="18"
          r="3"
        />

        <circle
          cx="16"
          cy="16"
          r="3"
        />
      </svg>
    `;

  }


  if (
    category === 'video'
  ) {

    return `
      <svg viewBox="0 0 24 24">
        <rect
          x="3"
          y="5"
          width="14"
          height="14"
          rx="2"
        />

        <path
          d="m17 10 4-2v8l-4-2z"
        />
      </svg>
    `;

  }


  return `
    <svg viewBox="0 0 24 24">
      <path
        d="M6 2h8l4 4v16H6z"
      />

      <path
        d="M14 2v5h5"
      />
    </svg>
  `;

}


function trashIcon() {

  return `
    <svg viewBox="0 0 24 24">

      <path
        d="
          M4 7h16
          M9 7V4h6v3
          M8 11v6
          M12 11v6
          M16 11v6
          M6 7l1 14h10l1-14
        "
      />

    </svg>
  `;

}


// =========================
// FEEDBACK
// =========================

function showToast(
  message,
  strongFeedback = true
) {

  clearTimeout(
    toastTimer
  );


  toast.textContent =
    message;


  toast.classList.add(
    'show'
  );


  if (
    strongFeedback &&
    navigator.vibrate
  ) {

    navigator.vibrate(
      35
    );

  }


  if (
    strongFeedback
  ) {

    playFeedbackSound();

  }


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          'show'
        );

      },

      1700
    );

}


// som curtinho de confirmação

function playFeedbackSound() {

  try {

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioCtx) {
      return;
    }


    const context =
      new AudioCtx();


    const oscillator =
      context.createOscillator();


    const gain =
      context.createGain();


    oscillator.frequency.value =
      650;


    gain.gain.value =
      0.025;


    oscillator.connect(
      gain
    );


    gain.connect(
      context.destination
    );


    oscillator.start();


    oscillator.stop(
      context.currentTime +
      0.055
    );


  } catch {}

}


// =========================
// DESCONECTAR
// =========================

btnDestroy.addEventListener(
  'click',
  () => {

    stopQrTimers();

    stopScanner();


    if (
      socketReady()
    ) {

      socket.send(
        JSON.stringify({
          type:
            'end_session'
        })
      );


      // fallback caso o servidor
      // não responda
      setTimeout(
        goHome,
        700
      );

    } else {

      goHome();

    }

  }
);


function stopQrTimers() {

  clearInterval(
    pcQrInterval
  );

  clearInterval(
    pcTimerInterval
  );

  clearInterval(
    mobileQrInterval
  );

  clearInterval(
    mobileTimerInterval
  );

}


function goHome() {

  window.location.href =
    window.location.origin +
    window.location.pathname;

}


// =========================
// INICIALIZAÇÃO
// =========================

window.addEventListener(
  'DOMContentLoaded',
  () => {

    if (
      targetRoom
    ) {

      showConnectView(
        joiningView
      );

    } else if (
      isMobile
    ) {

      showConnectView(
        mobileView
      );

    } else {

      showConnectView(
        pcView
      );

    }


    connectSocket();

  }
);
