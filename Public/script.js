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

let pendingFile = null;

let mediaRecorder = null;
let recordingStream = null;
let audioChunks = [];

let toastTimer = null;


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
// ID DA SALA
// =========================

function createRoomId() {

  if (
    window.crypto &&
    typeof crypto.randomUUID === 'function'
  ) {

    return (
      'brg-' +
      crypto
        .randomUUID()
        .replaceAll('-', '')
        .substring(0, 12)
    );
  }

  return (
    'brg-' +
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 9)
  );
}


// =========================
// WEBSOCKET
// =========================

function connectSocket() {

  socket =
    new WebSocket(WS_URL);


  socket.onopen = () => {

    if (targetRoom) {

      showConnectView(joiningView);

      socket.send(
        JSON.stringify({
          type: 'join_room',
          roomId: targetRoom
        })
      );

      return;
    }


    if (isMobile) {

      showConnectView(mobileView);

    } else {

      showConnectView(pcView);

      startPcQrCycle();

    }

  };


  socket.onmessage = event => {

    let data;

    try {

      data =
        JSON.parse(event.data);

    } catch {

      return;

    }


    // CONECTOU
    if (data.type === 'connected') {

      stopQrTimers();

      stopScanner();

      activateApp();

      showToast('Dispositivo conectado ✓');

      return;
    }


    // TEXTO
    if (data.type === 'message') {

      addTextMessage(
        data.content,
        'other'
      );

      return;
    }


    // ARQUIVO
    if (data.type === 'file_offer') {

      pendingFile =
        data;

      modalText.textContent =
        `${data.name} • ${data.size}`;

      modal.classList.remove('hidden');

      return;
    }


    // ERRO
    if (data.type === 'error') {

      showToast(data.message);

      setTimeout(
        goHome,
        1300
      );

      return;
    }


    // OUTRO DISPOSITIVO DESCONECTOU
    if (
      data.type ===
      'peer_disconnected'
    ) {

      alert(
        'O outro dispositivo desconectou. A sessão foi encerrada.'
      );

      goHome();
    }

  };


  socket.onerror = () => {

    showToast(
      'Erro de conexão com o servidor'
    );

  };


  socket.onclose = () => {

    stopQrTimers();

  };

}


// =========================
// CONTROLE DE TELAS
// =========================

function hideConnectViews() {

  pcView.classList.add('hidden');

  mobileView.classList.add('hidden');

  scannerView.classList.add('hidden');

  mobileQrView.classList.add('hidden');

  joiningView.classList.add('hidden');

}


function showConnectView(view) {

  hideConnectViews();

  view.classList.remove('hidden');

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
// QR CODE DO PC
// =========================

function startPcQrCycle() {

  generatePcQr();

  clearInterval(
    pcQrInterval
  );

  /*
    Troca antes da expiração do servidor.
    Isso ajuda a reduzir QR escaneado
    exatamente no momento em que expira.
  */

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
    `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;


  qrcodeContainer.innerHTML =
    '';


  new QRCode(
    qrcodeContainer,
    {
      text: joinUrl,

      width: 170,
      height: 170,

      colorDark: '#04121a',

      colorLight: '#ffffff',

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
// QR CODE DO CELULAR
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
    `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;


  mobileQrcode.innerHTML =
    '';


  new QRCode(
    mobileQrcode,
    {
      text: joinUrl,

      width: 170,
      height: 170,

      colorDark: '#04121a',

      colorLight: '#ffffff',

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

  let seconds =
    50;


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
            Math.max(
              seconds,
              0
            ) / 50 * 100
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
          facingMode:
            'environment'
        },

        {
          fps: 15,

          /*
            Área grande para facilitar
            a leitura sem precisar
            enquadrar perfeitamente.
          */

          qrbox:
            (width, height) => {

              const size =
                Math.floor(
                  Math.min(
                    width,
                    height
                  ) * 0.76
                );


              return {
                width: size,
                height: size
              };
            },

          disableFlip:
            false
        },

        async decodedText => {

          /*
            Evita o leitor disparar
            várias vezes para o mesmo QR.
          */

          if (scanningLocked) {

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


          /*
            Só aceita QR deste próprio site.
          */

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


      /*
        Tenta aplicar zoom real na câmera.
        Alguns celulares suportam,
        outros simplesmente ignoram.
      */

      setTimeout(
        tryCameraZoom,
        700
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


async function stopScanner() {

  if (!scanner) {

    return;

  }


  try {

    await scanner.stop();

  } catch {}


  try {

    await scanner.clear();

  } catch {}


  scanner =
    null;

}


async function tryCameraZoom() {

  try {

    const video =
      document.querySelector(
        '#reader video'
      );


    if (
      !video ||
      !video.srcObject
    ) {

      return;

    }


    const track =
      video
        .srcObject
        .getVideoTracks()[0];


    if (!track) {

      return;

    }


    const capabilities =
      track.getCapabilities
        ? track.getCapabilities()
        : {};


    if (!capabilities.zoom) {

      return;

    }


    const min =
      capabilities.zoom.min || 1;

    const max =
      capabilities.zoom.max || 1;


    /*
      Zoom moderado.
      Não queremos aproximar demais.
    */

    const desired =
      Math.min(
        max,
        Math.max(
          min,
          1.6
        )
      );


    await track.applyConstraints({
      advanced: [
        {
          zoom: desired
        }
      ]
    });


  } catch (error) {

    console.log(
      'Zoom da câmera não suportado.'
    );

  }

}


// =========================
// ABAS
// =========================

tabs.forEach(
  tab => {

    tab.addEventListener(
      'click',
      () => {

        tabs.forEach(
          item =>
            item.classList.remove(
              'active'
            )
        );


        panels.forEach(
          panel =>
            panel.classList.remove(
              'active'
            )
        );


        tab.classList.add(
          'active'
        );


        const target =
          document.getElementById(
            `tab-${tab.dataset.tab}`
          );


        target.classList.add(
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
  event => {

    /*
      Enter envia.
      Shift + Enter quebra linha.
    */

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


  if (!content) {

    return;

  }


  if (
    !socket ||
    socket.readyState !==
      WebSocket.OPEN
  ) {

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

        await navigator.clipboard.writeText(
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
// ARQUIVOS
// =========================

selectButton.addEventListener(
  'click',
  event => {

    /*
      Impede o clique no botão
      de disparar o label duas vezes.
    */

    event.preventDefault();

    event.stopPropagation();


    attachFile.click();

  }
);


attachFile.addEventListener(
  'change',
  event => {

    const files =
      Array.from(
        event.target.files
      );


    files.forEach(
      sendFile
    );


    event.target.value =
      '';

  }
);


attachPhoto.addEventListener(
  'change',
  event => {

    const file =
      event.target.files[0];


    if (file) {

      sendFile(file);

    }


    event.target.value =
      '';

  }
);


attachAudio.addEventListener(
  'change',
  event => {

    const file =
      event.target.files[0];


    if (file) {

      sendFile(file);

    }


    event.target.value =
      '';

  }
);


function sendFile(file) {

  /*
    Como o protótipo envia Base64
    pelo WebSocket, vamos limitar
    arquivos grandes por enquanto.
  */

  const maxSize =
    6 * 1024 * 1024;


  if (
    file.size >
    maxSize
  ) {

    showToast(
      'Protótipo: limite de 6 MB'
    );

    return;

  }


  const reader =
    new FileReader();


  reader.onload =
    () => {

      const fileData = {
        type:
          'file_offer',

        name:
          file.name,

        size:
          formatBytes(
            file.size
          ),

        mime:
          file.type,

        category:
          fileCategory(
            file
          ),

        data:
          reader.result
      };


      socket.send(
        JSON.stringify(
          fileData
        )
      );


      addFileCard(
        fileData,
        'me'
      );


      showToast(
        'Arquivo enviado ✓'
      );

    };


  reader.readAsDataURL(
    file
  );

}


// =========================
// DRAG AND DROP
// =========================

[
  'dragenter',
  'dragover'
].forEach(
  eventName => {

    dropZone.addEventListener(
      eventName,
      event => {

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
  eventName => {

    dropZone.addEventListener(
      eventName,
      event => {

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
  event => {

    const files =
      Array.from(
        event.dataTransfer.files
      );


    files.forEach(
      sendFile
    );

  }
);


// =========================
// RECEBIMENTO / DOWNLOAD
// =========================

btnModalAccept.addEventListener(
  'click',
  () => {

    if (!pendingFile) {

      return;

    }


    const file =
      pendingFile;


    downloadFile(
      file
    );


    addFileCard(
      file,
      'other'
    );


    pendingFile =
      null;


    modal.classList.add(
      'hidden'
    );


    showToast(
      '✓ Download iniciado'
    );

  }
);


btnModalReject.addEventListener(
  'click',
  () => {

    pendingFile =
      null;


    modal.classList.add(
      'hidden'
    );


    showToast(
      'Arquivo recusado',
      false
    );

  }
);


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
// CARDS DE ARQUIVO
// =========================

function addFileCard(
  file,
  sender
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
    `file-card ${
      category === 'audio'
        ? 'audio-card'
        : ''
    }`;


  const icon =
    document.createElement(
      'div'
    );


  icon.className =
    'file-card-icon';


  icon.textContent =
    iconForCategory(
      category
    );


  const info =
    document.createElement(
      'div'
    );


  info.className =
    'file-card-info';


  const title =
    document.createElement(
      'strong'
    );


  title.textContent =
    file.name;


  const detail =
    document.createElement(
      'small'
    );


  detail.textContent =
    `${file.size} • ${
      sender === 'me'
        ? 'Enviado'
        : 'Recebido'
    }`;


  info.append(
    title,
    detail
  );


  card.append(
    icon,
    info
  );


  /*
    Preview de imagem
  */

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


    info.appendChild(
      preview
    );

  }


  /*
    Player de áudio
  */

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


    info.appendChild(
      audio
    );

  }


  feed.prepend(
    card
  );

}


// =========================
// GRAVAÇÃO DE ÁUDIO
// =========================

btnRecord.addEventListener(
  'click',
  async () => {

    /*
      Já está gravando:
      clique novamente para parar.
    */

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
        event => {

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
                track =>
                  track.stop()
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
// UTILIDADES DE ARQUIVO
// =========================

function fileCategory(file) {

  return categoryFromMime(
    file.type
  );

}


function categoryFromMime(mime = '') {

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


function iconForCategory(category) {

  if (
    category === 'image'
  ) {

    return '🖼';

  }


  if (
    category === 'audio'
  ) {

    return '♪';

  }


  if (
    category === 'video'
  ) {

    return '▶';

  }


  return '↥';

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
      `${(
        bytes / 1024
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


  /*
    Vibração curta no celular.
  */

  if (
    strongFeedback &&
    navigator.vibrate
  ) {

    navigator.vibrate(
      35
    );

  }


  /*
    Som curto.
    Principalmente útil para
    copiar e download.
  */

  if (strongFeedback) {

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


    if (socket) {

      socket.close();

    }


    goHome();

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

    if (targetRoom) {

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
