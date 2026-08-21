// =========================
// CONFIGURAÇÃO
// =========================

const WS_URL =
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`;


const isMobile =
  /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );


const params =
  new URLSearchParams(
    window.location.search
  );


const targetRoom =
  params.get('room');


// =========================
// ESTADO
// =========================

let socket = null;

let currentRoomId = null;

let qrCreator =
  null;


let pcQrInterval =
  null;

let pcTimerInterval =
  null;


let mobileQrInterval =
  null;

let mobileTimerInterval =
  null;


let scanner = null;

let scanningLocked =
  false;


let mediaRecorder =
  null;

let recordingStream =
  null;

let audioChunks =
  [];


let toastTimer =
  null;


let reconnectTimer =
  null;

let presenceInterval =
  null;

let networkCheckInterval =
  null;

let lastNetworkId =
  null;

let socketGeneration =
  0;


// Arquivos recebidos
// ficam em fila

const incomingQueue =
  [];

let currentIncoming =
  null;


// Arquivos enviados
// permanecem na memória
// durante a sessão

const sentTransfers =
  new Map();


// transferId -> card

const transferCards =
  new Map();


// =========================
// ELEMENTOS
// =========================

const screenConnect =
  document.getElementById(
    'screen-connect'
  );


const screenApp =
  document.getElementById(
    'screen-app'
  );


const pcView =
  document.getElementById(
    'pc-view'
  );


const mobileView =
  document.getElementById(
    'mobile-view'
  );


const scannerView =
  document.getElementById(
    'scanner-view'
  );


const mobileQrView =
  document.getElementById(
    'mobile-qr-view'
  );


const joiningView =
  document.getElementById(
    'joining-view'
  );


const qrcodeContainer =
  document.getElementById(
    'qrcode'
  );


const qrProgress =
  document.getElementById(
    'qr-progress'
  );


const timerText =
  document.getElementById(
    'timer-text'
  );


const mobileQrcode =
  document.getElementById(
    'mobile-qrcode'
  );


const mobileQrProgress =
  document.getElementById(
    'mobile-qr-progress'
  );


const mobileTimerText =
  document.getElementById(
    'mobile-timer-text'
  );


const btnOpenScanner =
  document.getElementById(
    'btn-open-scanner'
  );


const btnCloseScanner =
  document.getElementById(
    'btn-close-scanner'
  );


const btnGenerateQR =
  document.getElementById(
    'btn-generate-qr'
  );


const btnBackMobileQR =
  document.getElementById(
    'btn-back-mobile-qr'
  );


const btnDestroy =
  document.getElementById(
    'btn-destroy'
  );


const tabs =
  document.querySelectorAll(
    '.tab'
  );


const panels =
  document.querySelectorAll(
    '.tab-panel'
  );


const dropZone =
  document.getElementById(
    'drop-zone'
  );


const selectButton =
  document.querySelector(
    '.select-button'
  );


const attachFile =
  document.getElementById(
    'attach-file'
  );


const attachPhoto =
  document.getElementById(
    'attach-photo'
  );


const attachAudio =
  document.getElementById(
    'attach-audio'
  );


const mediaFeed =
  document.getElementById(
    'media-feed'
  );


const textFeed =
  document.getElementById(
    'text-feed'
  );


const audioFeed =
  document.getElementById(
    'audio-feed'
  );


const textInput =
  document.getElementById(
    'text-input'
  );


const btnSendText =
  document.getElementById(
    'btn-send-text'
  );


const btnRecord =
  document.getElementById(
    'btn-record'
  );


const recordIcon =
  document.getElementById(
    'record-icon'
  );


const recordText =
  document.getElementById(
    'record-text'
  );


const modal =
  document.getElementById(
    'modal-confirm'
  );


const modalText =
  document.getElementById(
    'modal-text'
  );


const btnModalAccept =
  document.getElementById(
    'btn-modal-accept'
  );


const btnModalReject =
  document.getElementById(
    'btn-modal-reject'
  );


const toast =
  document.getElementById(
    'toast'
  );

const btnSettings = document.getElementById('btn-settings');
const btnNearbyDesktop = document.getElementById('btn-nearby-desktop');
const btnNearbyMobile = document.getElementById('btn-nearby-mobile');
const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const languageOptions = document.querySelectorAll('.language-option');
const modalNearby = document.getElementById('modal-nearby');
const nearbyList = document.getElementById('nearby-list');
const btnCloseNearby = document.getElementById('btn-close-nearby');
const btnRefreshNearby = document.getElementById('btn-refresh-nearby');
const modalConnectionRequest = document.getElementById('modal-connection-request');
const connectionRequestText = document.getElementById('connection-request-text');
const btnAcceptConnection = document.getElementById('btn-accept-connection');
const btnRejectConnection = document.getElementById('btn-reject-connection');

let incomingConnectionRequest = null;
let currentLanguage = localStorage.getItem('ponte-language') ||
  (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en');


// =========================
// IDS
// =========================

function randomId(
  prefix = 'id'
) {

  if (
    window.crypto &&
    typeof crypto.randomUUID ===
      'function'
  ) {

    return (
      `${prefix}-` +
      crypto
        .randomUUID()
        .replaceAll(
          '-',
          ''
        )
        .substring(
          0,
          16
        )
    );

  }


  return (
    `${prefix}-` +
    Date.now()
      .toString(36) +
    Math.random()
      .toString(36)
      .substring(
        2,
        9
      )
  );

}


function createRoomId() {

  return randomId(
    'brg'
  );

}


function createTransferId() {

  return randomId(
    'trf'
  );

}


function getPersistentDeviceId() {
  const storageKey = 'ponte-device-id';
  let id = localStorage.getItem(storageKey);

  if (!id) {
    id = randomId('dev');
    localStorage.setItem(storageKey, id);
  }

  return id;
}

function detectDeviceInfo() {
  const ua = navigator.userAgent || '';
  let deviceType = 'device';
  let deviceName = 'Dispositivo';

  if (/Android/i.test(ua)) {
    deviceType = 'phone';

    const samsungModel = ua.match(/\b(SM-[A-Z0-9-]+)\b/i);
    const androidModel = ua.match(/Android[^;]*;\s*([^;()]+?)(?:\s+Build\/|;|\))/i);

    if (samsungModel && samsungModel[1]) {
      deviceName = `Samsung ${samsungModel[1].toUpperCase()}`;
    } else if (androidModel && androidModel[1]) {
      deviceName = androidModel[1].trim() || 'Android';
    } else {
      deviceName = 'Android';
    }
  } else if (/iPhone/i.test(ua)) {
    deviceType = 'phone';
    deviceName = 'iPhone';
  } else if (/iPad/i.test(ua)) {
    deviceType = 'phone';
    deviceName = 'iPad';
  } else if (/Windows/i.test(ua)) {
    deviceType = 'computer';
    deviceName = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceType = 'computer';
    deviceName = 'Mac';
  } else if (/Linux/i.test(ua)) {
    deviceType = 'computer';
    deviceName = 'Linux PC';
  }

  return {
    deviceId: getPersistentDeviceId(),
    deviceType,
    deviceName
  };
}

let deviceIdentity = detectDeviceInfo();

async function enrichDeviceIdentity() {
  try {
    if (
      navigator.userAgentData &&
      typeof navigator.userAgentData.getHighEntropyValues === 'function'
    ) {
      const values = await navigator.userAgentData.getHighEntropyValues([
        'model',
        'platform'
      ]);

      if (values.model) {
        const model = String(values.model).trim();

        if (model) {
          deviceIdentity.deviceName =
            /^SM-/i.test(model)
              ? `Samsung ${model.toUpperCase()}`
              : model;
        }
      }
    }
  } catch {}

  registerDevice();
}

const translations = {
  pt: {
    brandSubtitle: 'Transferência temporária entre dispositivos',
    connectPhone: 'Conectar celular',
    scanWithPhone: 'Escaneie o QR Code com seu celular',
    temporarySession: '🔒 Sessão temporária e de uso único',
    connectDevice: 'Conectar dispositivo',
    chooseStart: 'Escolha como deseja iniciar',
    scanQr: 'Escanear QR Code',
    connectAnother: 'Conectar a outro dispositivo',
    generateQr: 'Gerar QR Code',
    otherPhoneScans: 'Outro celular escaneia você',
    nearby: 'Dispositivos próximos',
    nearbySubtitle: 'Conectar sem usar QR Code',
    positionQr: 'Posicione o código dentro da área',
    back: '← Voltar',
    yourQr: 'Seu QR Code',
    askOtherScan: 'Peça para o outro celular escanear',
    connecting: 'Conectando...',
    validating: 'Validando a sessão',
    connected: 'Conectado',
    disconnect: 'Desconectar',
    media: 'Mídia',
    text: 'Texto',
    audio: 'Áudio',
    filesPhotos: 'Arquivos e fotos',
    sendFilesConnected: 'Envie arquivos para o dispositivo conectado',
    dropFiles: 'Solte arquivos aqui',
    orSelect: 'ou selecione manualmente',
    selectFiles: 'Selecionar arquivos',
    selectPhotos: 'Selecionar fotos',
    sendTexts: 'Envie textos, links ou códigos',
    recordOrImport: 'Grave agora ou importe um áudio',
    importAudios: 'Importar áudios',
    recordAudio: 'Gravar áudio',
    settings: 'Configurações',
    languageDescription: 'Escolha o idioma da interface',
    nearbyDescription: 'Dispositivos disponíveis nesta rede',
    refresh: '↻ Atualizar',
    connectionRequest: 'Solicitação de conexão',
    reject: 'Recusar',
    accept: 'Aceitar',
    contentReceived: 'Conteúdo recebido',
    download: 'Baixar',
    available: 'Disponível',
    connect: 'Conectar',
    noDevices: 'Nenhum dispositivo disponível nesta rede.',
    wantsConnect: 'quer se conectar a este dispositivo.',
    requestSent: 'Solicitação enviada',
    requestRejected: 'Solicitação recusada',
    deviceUnavailable: 'O dispositivo não está mais disponível',
    updating: 'Atualizando...',
    connectedToast: 'Dispositivo conectado ✓',
    sessionEnded: 'Sessão encerrada',
    serverConnectionError: 'Erro de conexão com o servidor',
    serverConnecting: 'Servidor ainda conectando...',
    invalidQr: 'QR Code inválido',
    cameraOpenError: 'Não foi possível abrir a câmera',
    connectionUnavailable: 'Conexão indisponível',
    textSent: 'Texto enviado ✓',
    copy: 'Copiar',
    copied: '✓ Copiado',
    copiedClipboard: 'Copiado para a área de transferência',
    copyError: 'Não foi possível copiar',
    downloadStarted: '✓ Download iniciado',
    fileRejected: 'Arquivo recusado',
    fileReceived: 'Arquivo recebido pelo outro dispositivo ✓',
    resendUnavailable: 'Esse arquivo não está mais disponível para reenvio',
    removeHistory: 'Remover do histórico',
    removedHistory: 'Removido do histórico',
    resend: '↻ Reenviar',
    pendingTransfer: '◷ Aguardando resposta...',
    transferAccepted: '✓ Recebido pelo outro dispositivo',
    transferRejected: '✕ Recusado',
    stopRecording: 'Parar gravação',
    recordingStarted: 'Gravação iniciada',
    microphoneError: 'Não foi possível acessar o microfone',
    nearbyReconnecting: 'Reconectando à rede...'
  },

  en: {
    brandSubtitle: 'Temporary transfer between devices',
    connectPhone: 'Connect phone',
    scanWithPhone: 'Scan the QR Code with your phone',
    temporarySession: '🔒 Temporary, single-use session',
    connectDevice: 'Connect device',
    chooseStart: 'Choose how you want to start',
    scanQr: 'Scan QR Code',
    connectAnother: 'Connect to another device',
    generateQr: 'Generate QR Code',
    otherPhoneScans: 'Another phone scans your code',
    nearby: 'Nearby devices',
    nearbySubtitle: 'Connect without using a QR Code',
    positionQr: 'Position the code inside the area',
    back: '← Back',
    yourQr: 'Your QR Code',
    askOtherScan: 'Ask the other phone to scan it',
    connecting: 'Connecting...',
    validating: 'Validating session',
    connected: 'Connected',
    disconnect: 'Disconnect',
    media: 'Media',
    text: 'Text',
    audio: 'Audio',
    filesPhotos: 'Files and photos',
    sendFilesConnected: 'Send files to the connected device',
    dropFiles: 'Drop files here',
    orSelect: 'or select them manually',
    selectFiles: 'Select files',
    selectPhotos: 'Select photos',
    sendTexts: 'Send text, links or code',
    recordOrImport: 'Record now or import audio',
    importAudios: 'Import audio',
    recordAudio: 'Record audio',
    settings: 'Settings',
    languageDescription: 'Choose the interface language',
    nearbyDescription: 'Available devices on this network',
    refresh: '↻ Refresh',
    connectionRequest: 'Connection request',
    reject: 'Reject',
    accept: 'Accept',
    contentReceived: 'Content received',
    download: 'Download',
    available: 'Available',
    connect: 'Connect',
    noDevices: 'No devices are available on this network.',
    wantsConnect: 'wants to connect to this device.',
    requestSent: 'Request sent',
    requestRejected: 'Request rejected',
    deviceUnavailable: 'The device is no longer available',
    updating: 'Refreshing...',
    connectedToast: 'Device connected ✓',
    sessionEnded: 'Session ended',
    serverConnectionError: 'Server connection error',
    serverConnecting: 'Server is still connecting...',
    invalidQr: 'Invalid QR Code',
    cameraOpenError: 'Could not open the camera',
    connectionUnavailable: 'Connection unavailable',
    textSent: 'Text sent ✓',
    copy: 'Copy',
    copied: '✓ Copied',
    copiedClipboard: 'Copied to clipboard',
    copyError: 'Could not copy',
    downloadStarted: '✓ Download started',
    fileRejected: 'File rejected',
    fileReceived: 'File received by the other device ✓',
    resendUnavailable: 'This file is no longer available to resend',
    removeHistory: 'Remove from history',
    removedHistory: 'Removed from history',
    resend: '↻ Resend',
    pendingTransfer: '◷ Waiting for response...',
    transferAccepted: '✓ Received by the other device',
    transferRejected: '✕ Rejected',
    stopRecording: 'Stop recording',
    recordingStarted: 'Recording started',
    microphoneError: 'Could not access the microphone',
    nearbyReconnecting: 'Reconnecting to the network...'
  }
};

function t(key) {
  return translations[currentLanguage]?.[key] || translations.pt[key] || key;
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === 'pt' ? 'pt-BR' : 'en';

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[currentLanguage]?.[key]) {
      element.textContent = translations[currentLanguage][key];
    }
  });

  languageOptions.forEach((option) => {
    option.classList.toggle('active', option.dataset.language === currentLanguage);
  });


  if (textInput) {
    textInput.placeholder =
      currentLanguage === 'pt'
        ? 'Digite ou cole um texto...'
        : 'Type or paste text...';
  }


  if (
    recordText &&
    !mediaRecorder
  ) {
    recordText.textContent =
      t('recordAudio');
  }


  renderNearbyDevices(
    []
  );
}

function registerDevice() {
  if (!socketReady()) return;

  socket.send(JSON.stringify({
    type: 'register_device',
    ...deviceIdentity,
    available:
      !targetRoom &&
      screenApp
        .classList
        .contains(
          'hidden'
        )
  }));
}


function sendPresencePing() {
  if (!socketReady()) return;

  socket.send(
    JSON.stringify({
      type:
        'presence_ping',

      deviceId:
        deviceIdentity.deviceId,

      available:
        !targetRoom &&
        screenApp
          .classList
          .contains(
            'hidden'
          )
    })
  );
}


function startPresenceLoop() {
  clearInterval(
    presenceInterval
  );

  presenceInterval =
    setInterval(
      () => {
        sendPresencePing();
      },
      4000
    );
}


function stopPresenceLoop() {
  clearInterval(
    presenceInterval
  );

  presenceInterval =
    null;
}


async function readCurrentNetworkId() {
  try {
    const response =
      await fetch(
        `/network-id?_=${Date.now()}`,
        {
          cache:
            'no-store'
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return (
      data.networkId ||
      null
    );
  }
  catch {
    return null;
  }
}


async function checkNetworkChange(
  forceRefresh = false
) {
  const networkId =
    await readCurrentNetworkId();

  if (!networkId) {
    return false;
  }


  if (
    lastNetworkId &&
    networkId !==
      lastNetworkId
  ) {
    lastNetworkId =
      networkId;

    showToast(
      t(
        'nearbyReconnecting'
      ),
      false
    );

    if (
      socket &&
      (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      try {
        socket.close(
          4002,
          'Rede alterada'
        );
      }
      catch {}
    }

    scheduleReconnect(
      120
    );

    return true;
  }


  lastNetworkId =
    networkId;


  if (
    forceRefresh &&
    socketReady()
  ) {
    registerDevice();
    sendPresencePing();

    socket.send(
      JSON.stringify({
        type:
          'get_nearby'
      })
    );
  }


  return false;
}


function startNetworkWatch() {
  clearInterval(
    networkCheckInterval
  );

  networkCheckInterval =
    setInterval(
      () => {
        if (
          screenApp
            .classList
            .contains(
              'hidden'
            )
        ) {
          checkNetworkChange(
            false
          );
        }
      },
      5000
    );
}


function stopNetworkWatch() {
  clearInterval(
    networkCheckInterval
  );

  networkCheckInterval =
    null;
}


function requestNearbyDevices() {
  if (!socketReady()) {
    scheduleReconnect(
      0
    );

    return;
  }

  registerDevice();
  sendPresencePing();

  socket.send(
    JSON.stringify({
      type:
        'get_nearby'
    })
  );
}


async function refreshNearbyDevices() {
  const label =
    btnRefreshNearby
      .querySelector(
        '[data-i18n="refresh"]'
      );

  btnRefreshNearby.disabled =
    true;

  if (label) {
    label.textContent =
      t(
        'updating'
      );
  }


  const changed =
    await checkNetworkChange(
      true
    );


  if (
    !changed &&
    socketReady()
  ) {
    requestNearbyDevices();
  }


  setTimeout(
    () => {
      btnRefreshNearby.disabled =
        false;

      if (label) {
        label.textContent =
          t(
            'refresh'
          );
      }
    },
    700
  );
}

function deviceIcon(type) {
  if (type === 'phone') {
    return '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></svg>';
  }

  return '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>';
}

function renderNearbyDevices(devices = []) {
  nearbyList.innerHTML = '';

  if (!devices.length) {
    const empty = document.createElement('div');
    empty.className = 'nearby-empty';
    empty.textContent = t('noDevices');
    nearbyList.appendChild(empty);
    return;
  }

  devices.forEach((device) => {
    const row = document.createElement('div');
    row.className = 'nearby-device';

    const icon = document.createElement('div');
    icon.className = 'nearby-device-icon';
    icon.innerHTML = deviceIcon(device.deviceType);

    const info = document.createElement('div');
    info.className = 'nearby-device-info';

    const name = document.createElement('strong');
    name.textContent = device.deviceName;

    const status = document.createElement('small');
    status.textContent = `● ${t('available')}`;

    info.append(name, status);

    const button = document.createElement('button');
    button.className = 'nearby-connect-button';
    button.type = 'button';
    button.textContent = t('connect');
    button.addEventListener('click', () => {
      if (!socketReady()) return;

      socket.send(JSON.stringify({
        type: 'connection_request',
        targetId: device.deviceId
      }));

      showToast(t('requestSent'), false);
    });

    row.append(icon, info, button);
    nearbyList.appendChild(row);
  });
}

function openNearbyModal() {
  modalNearby.classList.remove('hidden');
  btnRefreshNearby.disabled = false;
  renderNearbyDevices([]);
  requestNearbyDevices();
}

function closeNearbyModal() {
  modalNearby.classList.add('hidden');
}

// =========================
// WEBSOCKET
// =========================

function scheduleReconnect(
  delay = 900
) {

  if (
    !screenApp
      .classList
      .contains(
        'hidden'
      )
  ) {
    return;
  }


  clearTimeout(
    reconnectTimer
  );


  reconnectTimer =
    setTimeout(
      () => {

        if (
          socket &&
          (
            socket.readyState ===
              WebSocket.OPEN ||
            socket.readyState ===
              WebSocket.CONNECTING
          )
        ) {
          return;
        }


        connectSocket();

      },
      delay
    );

}


function connectSocket() {

  clearTimeout(
    reconnectTimer
  );


  const generation =
    ++socketGeneration;


  const ws =
    new WebSocket(
      WS_URL
    );


  socket =
    ws;


  ws.onopen =
    async () => {

      if (
        socket !== ws ||
        generation !==
          socketGeneration
      ) {
        return;
      }


      registerDevice();
      enrichDeviceIdentity();

      startPresenceLoop();
      startNetworkWatch();

      const currentNetwork =
        await readCurrentNetworkId();

      if (currentNetwork) {
        lastNetworkId =
          currentNetwork;
      }


      // Entrou através
      // de um QR Code

      if (targetRoom) {

        showConnectView(
          joiningView
        );


        ws.send(
          JSON.stringify({
            type:
              'join_room',

            roomId:
              targetRoom
          })
        );


        return;

      }


      // Celular normal

      if (isMobile) {

        showConnectView(
          mobileView
        );

      }

      // PC

      else {

        showConnectView(
          pcView
        );


        startPcQrCycle();

      }

    };


  ws.onmessage =
    (event) => {

      let data;


      try {

        data =
          JSON.parse(
            event.data
          );

      } catch {

        return;

      }


      if (data.type === 'nearby_devices') {
        renderNearbyDevices(data.devices || []);
        return;
      }

      if (data.type === 'connection_request') {
        incomingConnectionRequest = data;
        connectionRequestText.textContent =
          `${data.requesterName} ${t('wantsConnect')}`;
        modalConnectionRequest.classList.remove('hidden');
        return;
      }

      if (data.type === 'connection_rejected') {
        showToast(t('requestRejected'), false);
        requestNearbyDevices();
        return;
      }

      if (data.type === 'connection_unavailable') {
        showToast(t('deviceUnavailable'), false);
        requestNearbyDevices();
        return;
      }

      // =========================
      // SALA CONFIRMADA
      // =========================

      if (
        data.type ===
        'room_created'
      ) {

        // Ignora confirmação
        // de QR antigo

        if (
          data.roomId !==
          currentRoomId
        ) {

          return;

        }


        drawConfirmedQr(
          data.roomId
        );


        return;

      }


      // =========================
      // CONECTOU
      // =========================

      if (
        data.type ===
        'connected'
      ) {

        stopQrTimers();

        stopScanner();

        modalNearby.classList.add('hidden');
        modalSettings.classList.add('hidden');
        modalConnectionRequest.classList.add('hidden');
        incomingConnectionRequest = null;

        activateApp();


        showToast(
          t('connectedToast')
        );


        return;

      }


      // =========================
      // TEXTO
      // =========================

      if (
        data.type ===
        'message'
      ) {

        showTabNotification(
          'text'
        );


        addTextMessage(
          data.content,
          'other'
        );


        return;

      }


      // =========================
      // ARQUIVO
      // =========================

      if (
        data.type ===
        'file_offer'
      ) {

        const targetTab =
          data.category ===
            'audio'
            ? 'audio'
            : 'media';


        showTabNotification(
          targetTab
        );


        queueIncomingTransfer(
          data
        );


        return;

      }


      // =========================
      // STATUS ARQUIVO
      // =========================

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


      // =========================
      // DESCONECTOU
      // =========================

      if (
        data.type ===
          'session_ended' ||
        data.type ===
          'peer_disconnected'
      ) {

        showToast(
          t('sessionEnded')
        );


        setTimeout(
          goHome,
          350
        );


        return;

      }


      // =========================
      // ERRO
      // =========================

      if (
        data.type ===
        'error'
      ) {

        showToast(
          data.message
        );


        setTimeout(
          goHome,
          1200
        );

      }

    };


  ws.onerror =
    () => {

      if (
        socket !== ws
      ) {
        return;
      }


      if (
        !screenApp
          .classList
          .contains(
            'hidden'
          )
      ) {

        showToast(
          t(
            'serverConnectionError'
          )
        );

      }

    };


  ws.onclose =
    () => {

      if (
        socket !== ws
      ) {
        return;
      }


      stopQrTimers();
      stopPresenceLoop();


      if (
        !screenApp
          .classList
          .contains(
            'hidden'
          )
      ) {

        setTimeout(
          goHome,
          250
        );

        return;

      }


      scheduleReconnect(
        700
      );

    };

}


// =========================
// TELAS
// =========================

function hideConnectViews() {

  pcView
    .classList
    .add('hidden');


  mobileView
    .classList
    .add('hidden');


  scannerView
    .classList
    .add('hidden');


  mobileQrView
    .classList
    .add('hidden');


  joiningView
    .classList
    .add('hidden');

}


function showConnectView(
  view
) {

  hideConnectViews();


  view
    .classList
    .remove(
      'hidden'
    );

}


function activateApp() {

  screenConnect
    .classList
    .add(
      'hidden'
    );


  screenApp
    .classList
    .remove(
      'hidden'
    );

}


// =========================
// PEDIR CRIAÇÃO DO QR
// =========================

function requestNewRoom(
  creator
) {

  if (
    !socketReady()
  ) {

    return;

  }


  qrCreator =
    creator;


  currentRoomId =
    createRoomId();


  socket.send(
    JSON.stringify({
      type:
        'create_room',

      roomId:
        currentRoomId
    })
  );

}


// =========================
// DESENHAR QR SOMENTE
// APÓS CONFIRMAÇÃO
// =========================

function drawConfirmedQr(
  roomId
) {

  const joinUrl =
    `${window.location.origin}` +
    `${window.location.pathname}` +
    `?room=${roomId}`;


  // =========================
  // QR DO PC
  // =========================

  if (
    qrCreator === 'pc'
  ) {

    qrcodeContainer.innerHTML =
      '';


    new QRCode(
      qrcodeContainer,
      {

        text:
          joinUrl,

        width:
          170,

        height:
          170,

        colorDark:
          '#04121a',

        colorLight:
          '#ffffff',

        correctLevel:
          QRCode.CorrectLevel.M

      }
    );


    startCountdown(
      timerText,
      qrProgress,
      'pc'
    );


    return;

  }


  // =========================
  // QR DO CELULAR
  // =========================

  if (
    qrCreator ===
    'mobile'
  ) {

    mobileQrcode.innerHTML =
      '';


    new QRCode(
      mobileQrcode,
      {

        text:
          joinUrl,

        width:
          170,

        height:
          170,

        colorDark:
          '#04121a',

        colorLight:
          '#ffffff',

        correctLevel:
          QRCode.CorrectLevel.M

      }
    );


    startCountdown(
      mobileTimerText,
      mobileQrProgress,
      'mobile'
    );

  }

}


// =========================
// QR PC
// =========================

function startPcQrCycle() {

  requestNewRoom(
    'pc'
  );


  clearInterval(
    pcQrInterval
  );


  pcQrInterval =
    setInterval(
      () => {

        requestNewRoom(
          'pc'
        );

      },

      50000
    );

}


// =========================
// QR CELULAR
// =========================

btnGenerateQR
  .addEventListener(
    'click',
    () => {

      if (
        !socketReady()
      ) {

        showToast(
          t('serverConnecting')
        );

        return;

      }


      showConnectView(
        mobileQrView
      );


      requestNewRoom(
        'mobile'
      );


      clearInterval(
        mobileQrInterval
      );


      mobileQrInterval =
        setInterval(
          () => {

            requestNewRoom(
              'mobile'
            );

          },

          50000
        );

    }
  );


btnBackMobileQR
  .addEventListener(
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
// CONTADOR
// =========================

function startCountdown(
  textElement,
  progressElement,
  type
) {

  let seconds =
    50;


  if (
    type === 'pc'
  ) {

    clearInterval(
      pcTimerInterval
    );

  }

  else {

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
              ) /
              50
            ) *
            100
          }%`;


        if (
          seconds <= 0
        ) {

          clearInterval(
            interval
          );

        }

      },

      1000
    );


  if (
    type === 'pc'
  ) {

    pcTimerInterval =
      interval;

  }

  else {

    mobileTimerInterval =
      interval;

  }

}


// =========================
// SCANNER
// =========================

btnOpenScanner
  .addEventListener(
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
              exact:
                'environment'
            }
          },


          {
            fps:
              18,

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
                    ) *
                    0.82
                  );


                return {
                  width:
                    size,

                  height:
                    size
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

            }

            catch {

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
                t('invalidQr')
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


      }

      catch (error) {

        console.error(
          'Erro ao abrir câmera:',
          error
        );


        showToast(
          t('cameraOpenError')
        );


        showConnectView(
          mobileView
        );

      }

    }
  );


btnCloseScanner
  .addEventListener(
    'click',

    async () => {

      await stopScanner();


      showConnectView(
        mobileView
      );

    }
  );


async function improveRunningCamera() {

  if (!scanner) {
    return;
  }


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

      constraints
        .advanced
        .push({

          focusMode:
            'continuous'

        });

    }


    if (
      capabilities.zoom
    ) {

      const min =
        capabilities.zoom.min ??
        1;


      const max =
        capabilities.zoom.max ??
        1;


      const desired =
        Math.min(
          max,
          Math.max(
            min,
            1.25
          )
        );


      constraints
        .advanced
        .push({

          zoom:
            desired

        });

    }


    if (
      capabilities.width &&
      capabilities.height
    ) {

      constraints.width = {
        ideal:
          1920
      };


      constraints.height = {
        ideal:
          1080
      };

    }


    if (
      constraints
        .advanced
        .length ||
      constraints.width
    ) {

      await scanner
        .applyVideoConstraints(
          constraints
        );

    }

  }

  catch {

    console.log(
      'Ajustes avançados de câmera não disponíveis.'
    );

  }

}


async function stopScanner() {

  if (!scanner) {
    return;
  }


  try {

    await scanner.stop();

  }

  catch {}


  try {

    scanner.clear();

  }

  catch {}


  scanner =
    null;

}


// =========================
// ABAS
// =========================

function showTabNotification(
  tabName
) {

  const tab =
    document.querySelector(
      `.tab[data-tab="${tabName}"]`
    );


  if (
    !tab ||
    tab.classList.contains(
      'active'
    )
  ) {

    return;

  }


  tab.classList.add(
    'has-notification'
  );

}


function clearTabNotification(
  tab
) {

  if (!tab) {
    return;
  }


  tab.classList.remove(
    'has-notification'
  );

}


tabs.forEach(
  (tab) => {

    tab.addEventListener(
      'click',
      () => {

        tabs.forEach(
          (item) => {

            item
              .classList
              .remove(
                'active'
              );

          }
        );


        panels.forEach(
          (panel) => {

            panel
              .classList
              .remove(
                'active'
              );

          }
        );


        tab
          .classList
          .add(
            'active'
          );


        clearTabNotification(
          tab
        );


        document
          .getElementById(
            `tab-${tab.dataset.tab}`
          )
          .classList
          .add(
            'active'
          );

      }
    );

  }
);


// =========================
// TEXTO
// =========================

btnSendText
  .addEventListener(
    'click',
    sendText
  );


textInput
  .addEventListener(
    'keydown',
    (event) => {

      if (
        event.key ===
          'Enter' &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendText();

      }

    }
  );


function sendText() {

  const content =
    textInput
      .value
      .trim();


  if (!content) {
    return;
  }


  if (!socketReady()) {

    showToast(
      t('connectionUnavailable')
    );

    return;

  }


  socket.send(
    JSON.stringify({

      type:
        'message',

      content,

      contentType:
        'text'

    })
  );


  addTextMessage(
    content,
    'me'
  );


  textInput.value =
    '';


  showToast(
    t('textSent'),
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
    t('copy');


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
          t('copied');


        copy.classList.add(
          'copied'
        );


        showToast(
          t('copiedClipboard')
        );


        setTimeout(
          () => {

            copy.textContent =
              t('copy');


            copy
              .classList
              .remove(
                'copied'
              );

          },

          1600
        );

      }

      catch {

        showToast(
          t('copyError')
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
// ARQUIVOS MÚLTIPLOS
// =========================

selectButton
  .addEventListener(
    'click',
    (event) => {

      event.preventDefault();

      event.stopPropagation();


      attachFile.click();

    }
  );


attachFile
  .addEventListener(
    'change',
    (event) => {

      sendFiles(
        Array.from(
          event.target.files
        )
      );


      event.target.value =
        '';

    }
  );


attachPhoto
  .addEventListener(
    'change',
    (event) => {

      sendFiles(
        Array.from(
          event.target.files
        )
      );


      event.target.value =
        '';

    }
  );


attachAudio
  .addEventListener(
    'change',
    (event) => {

      sendFiles(
        Array.from(
          event.target.files
        )
      );


      event.target.value =
        '';

    }
  );


function sendFiles(
  files
) {

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

function sendFile(
  file
) {

  const maxSize =
    6 *
    1024 *
    1024;


  if (
    file.size >
    maxSize
  ) {

    showToast(
      `"${file.name}" passou do limite de 6 MB`
    );

    return;

  }


  if (!socketReady()) {

    showToast(
      t('connectionUnavailable')
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
// DRAG & DROP
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


        dropZone
          .classList
          .add(
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


        dropZone
          .classList
          .remove(
            'dragging'
          );

      }
    );

  }
);


dropZone.addEventListener(
  'drop',
  (event) => {

    sendFiles(
      Array.from(
        event
          .dataTransfer
          .files
      )
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


  modal
    .classList
    .remove(
      'hidden'
    );

}


// =========================
// ACEITAR ARQUIVO
// =========================

btnModalAccept
  .addEventListener(
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


      modal
        .classList
        .add(
          'hidden'
        );


      currentIncoming =
        null;


      showToast(
        t('downloadStarted')
      );


      showNextIncoming();

    }
  );


// =========================
// RECUSAR
// =========================

btnModalReject
  .addEventListener(
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


      modal
        .classList
        .add(
          'hidden'
        );


      currentIncoming =
        null;


      showToast(
        t('fileRejected'),
        false
      );


      showNextIncoming();

    }
  );


// =========================
// STATUS
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
    status ===
    'accepted'
  ) {

    showToast(
      t('fileReceived')
    );

  }


  if (
    status ===
    'rejected'
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
      t('resendUnavailable')
    );

    return;

  }


  if (!socketReady()) {

    showToast(
      t('connectionUnavailable')
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

function downloadFile(
  file
) {

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
// CARD DE ARQUIVO
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
    t('removeHistory');


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
        t('removedHistory'),
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


  // IMAGEM

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


  // ÁUDIO

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


  // REENVIAR

  const retryButton =
    document.createElement(
      'button'
    );


  retryButton.className =
    'retry-button';


  retryButton.textContent =
    t('resend');


  retryButton.addEventListener(
    'click',
    () => {

      resendTransfer(
        file.transferId
      );

    }
  );


  statusRow.appendChild(
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
// STATUS VISUAL
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
    status ===
    'pending'
  ) {

    statusText.textContent =
      t('pendingTransfer');

  }


  if (
    status ===
    'accepted'
  ) {

    statusText.textContent =
      t('transferAccepted');

  }


  if (
    status ===
    'rejected'
  ) {

    statusText.textContent =
      t('transferRejected');

  }

}


// =========================
// GRAVAÇÃO DE ÁUDIO
// =========================

btnRecord.addEventListener(
  'click',

  async () => {

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

            audio:
              true

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
            event.data.size >
            0
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

                type:
                  mime

              }
            );


          const file =
            new File(
              [blob],

              `audio-${Date.now()}.webm`,

              {

                type:
                  mime

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


          btnRecord
            .classList
            .remove(
              'recording'
            );


          recordIcon.textContent =
            '●';


          recordText.textContent =
            t('recordAudio');


          sendFile(
            file
          );

        };


      mediaRecorder.start();


      btnRecord
        .classList
        .add(
          'recording'
        );


      recordIcon.textContent =
        '■';


      recordText.textContent =
        t('stopRecording');


      showToast(
        t('recordingStarted'),
        false
      );

    }


    catch (error) {

      console.error(
        'Erro no microfone:',
        error
      );


      showToast(
        t('microphoneError')
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


function fileCategory(
  file
) {

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


function formatBytes(
  bytes
) {

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
      `${(
        bytes /
        1024
      ).toFixed(1)} KB`
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
    category ===
    'image'
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
    category ===
    'audio'
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
    category ===
    'video'
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
// CONFIGURAÇÕES / PRÓXIMOS
// =========================

btnSettings.addEventListener('click', () => {
  applyLanguage();
  modalSettings.classList.remove('hidden');
});

btnCloseSettings.addEventListener('click', () => {
  modalSettings.classList.add('hidden');
});

languageOptions.forEach((option) => {
  option.addEventListener('click', () => {
    currentLanguage = option.dataset.language;
    localStorage.setItem('ponte-language', currentLanguage);
    applyLanguage();
    renderNearbyDevices([]);
  });
});

btnNearbyDesktop.addEventListener('click', openNearbyModal);
btnNearbyMobile.addEventListener('click', openNearbyModal);
btnRefreshNearby.addEventListener(
  'click',
  refreshNearbyDevices
);
btnCloseNearby.addEventListener('click', closeNearbyModal);

btnAcceptConnection.addEventListener('click', () => {
  if (!incomingConnectionRequest || !socketReady()) return;

  socket.send(JSON.stringify({
    type: 'connection_response',
    requesterId: incomingConnectionRequest.requesterId,
    accepted: true
  }));

  modalConnectionRequest.classList.add('hidden');
});

btnRejectConnection.addEventListener('click', () => {
  if (!incomingConnectionRequest || !socketReady()) return;

  socket.send(JSON.stringify({
    type: 'connection_response',
    requesterId: incomingConnectionRequest.requesterId,
    accepted: false
  }));

  incomingConnectionRequest = null;
  modalConnectionRequest.classList.add('hidden');
});

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


  toast
    .classList
    .add(
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

        toast
          .classList
          .remove(
            'show'
          );

      },

      1700
    );

}


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
      context
        .createOscillator();


    const gain =
      context
        .createGain();


    oscillator
      .frequency
      .value =
        650;


    gain
      .gain
      .value =
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

  }

  catch {}

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


      setTimeout(
        goHome,
        700
      );

    }

    else {

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


window.addEventListener(
  'online',
  () => {
    checkNetworkChange(
      true
    );

    scheduleReconnect(
      0
    );
  }
);


window.addEventListener(
  'offline',
  () => {
    renderNearbyDevices(
      []
    );
  }
);


// =========================
// INICIAR
// =========================

window.addEventListener(
  'DOMContentLoaded',
  () => {

    applyLanguage();

    if (
      targetRoom
    ) {

      showConnectView(
        joiningView
      );

    }

    else if (
      isMobile
    ) {

      showConnectView(
        mobileView
      );

    }

    else {

      showConnectView(
        pcView
      );

    }


    connectSocket();

  }
);
