/* Made by Sheeptester */

const consonants = 'bdfghjklmnprstvwz';
const vowels = 'aeiou';
function randomWord(syllables = 3, nasalChances = 0.3) {
  let word = '';
  for (let i = 0; i < syllables; i++) {
    const consonant = consonants[Math.random() * consonants.length >> 0];
    if (consonant !== word[word.length - 1])
      word += consonant; // no double n
    word += vowels[Math.random() * vowels.length >> 0];
    if (Math.random() < nasalChances) word += 'n';
  }
  return word;
}

const SHU_PREFIX = 'shuriken-';
function createChat(on = {}, id = randomWord(), messages = [], userData = {}) {
  return new Promise((res, rej) => {
    const peer = new Peer(SHU_PREFIX + id);
    const members = []; // list of connections
    if (!userData[peer.id]) userData[peer.id] = {colour: '#ffffff', name: randomWord()};
    function broadcast(msg) {
      members.forEach(conn => conn.send(msg));
    }
    function announce(msg, time = Date.now()) {
      const msgObj = {type: 'announcement', content: encodeURIComponent(msg), time};
      messages.push(msgObj);
      broadcast({type: 'new-message', message: msgObj});
      if (on.message) on.message(msgObj);
    }
    function receive(peerID, data) {
      switch (data.type) {
        case 'new-message': {
          const msgObj = {type: 'message', content: data.content, author: peerID, time: data.time, data: data.data};
          messages.push(msgObj);
          broadcast({type: 'new-message', message: msgObj});
          if (on.message) on.message(msgObj);
          break;
        }
        case 'set-colour': {
          userData[peerID].colour = data.colour;
          broadcast({type: 'set-user-data', user: peerID, colour: data.colour});
          if (on.coloursUpdate) on.coloursUpdate(peerID);
          break;
        }
        case 'set-name': {
          const oldName = userData[peerID].name;
          userData[peerID].name = data.name;
          broadcast({type: 'set-user-data', user: peerID, name: data.name});
          announce(`${oldName} set their name to ${data.name} (id: ${peerID}).`);
          break;
        }
      }
    }
    function welcomeNewMember(conn) {
      members.push(conn);
      let unwelcomed = true;
      conn.on('open', () => {
        conn.send({type: 'welcome', messages, userData});
      });
      conn.on('data', data => {
        if (data.type === 'welcomed' && unwelcomed) {
          if (!userData[conn.peer]) {
            const name = randomWord();
            userData[conn.peer] = {colour: '#ffffff', name};
            broadcast({type: 'set-user-data', user: conn.peer, colour: '#ffffff', name});
            if (on.coloursUpdate) on.coloursUpdate(conn.peer);
          }
          announce(`${userData[conn.peer].name} joined (id: ${conn.peer}).`);
          unwelcomed = false;
        } else receive(conn.peer, data);
      });
      conn.on('close', () => {
        const index = members.indexOf(conn);
        if (~index) members.splice(index, 1);
        announce(`${userData[conn.peer].name} left (id: ${conn.peer}).`);
        delete userData[conn.peer];
        broadcast({type: 'user-left', user: conn.peer});
      });
    }
    peer.on('open', () => {
      Object.keys(userData).forEach(peerID => {
        if (peerID === peer.id) return;
        const conn = peer.connect(peerID);
        welcomeNewMember(conn);
      });
      peer.on('connection', welcomeNewMember);
      res({
        send(msg, metadata) {
          receive(peer.id, {type: 'new-message', content: encodeURIComponent(msg), time: Date.now(), data: metadata});
        },
        setColour(colour) {
          receive(peer.id, {type: 'set-colour', colour})
        },
        setName(name) {
          receive(peer.id, {type: 'set-name', name, time: Date.now()});
        },
        id,
        myID: peer.id
      });
      if (on.initialize) on.initialize(messages, userData);
      announce(`O ID do Chat é: "${id}, compartilhe o link para que outras pessoas entrem!`);
      document.getElementById("chat-id").textContent = `ID do Chat: "${id}"`
    });
    peer.on('error', rej);
  });
}
function joinChat(id, on = {}) {
  return new Promise((res, rej) => {
    const peer = new Peer();
    const obj = {id};
    let wasClosed = false, open = false;
    function treatConnection(conn) {
      if (open) return;
      open = true;
      let messages, userData;
      conn.on('data', data => {
        switch (data.type) {
          case 'welcome': {
            messages = data.messages;
            userData = data.userData;
            if (on.initialize) on.initialize(messages, userData);
            conn.send({type: 'welcomed'});
            break;
          }
          case 'new-message': {
            messages.push(data.message);
            if (on.message) on.message(data.message);
            break;
          }
          case 'set-user-data': {
            if (!userData[data.user]) userData[data.user] = {};
            if (data.colour) {
              userData[data.user].colour = data.colour;
              if (on.coloursUpdate) on.coloursUpdate(data.user);
            }
            if (data.name) {
              userData[data.user].name = data.name;
            }
            break;
          }
          case 'user-left': {
            delete userData[data.user];
            break;
          }
        }
      });
      obj.send = (msg, metadata) => conn.send({type: 'new-message', content: encodeURIComponent(msg), time: Date.now(), data: metadata});
      obj.setColour = colour => conn.send({type: 'set-colour', colour});
      obj.setName = name => conn.send({type: 'set-name', name, time: Date.now()});
      obj.destroy = () => peer.destroy();
      obj.myID = peer.id;
      conn.on('close', () => {
        delete userData[conn.peer];
        if (on.close) on.close();
        wasClosed = true;
        open = false;
      });
      if (wasClosed && on.reopen) on.reopen();
    }
    peer.on('open', () => {
      const conn = peer.connect(SHU_PREFIX + id);
      treatConnection(conn);
      conn.on('open', () => {
        res(obj);
      });
      peer.on('connection', treatConnection);
      conn.on('error', rej);
    });
    peer.on('error', rej);
  });
}

const chat = document.getElementById('chat');
const messageInput = document.getElementById('message');
let onsubmit = null;
messageInput.addEventListener('keydown', e => {
  const trueValue = messageInput.value.trim();
  if (e.keyCode === 13 && trueValue && onsubmit) {
    onsubmit(trueValue);
    messageInput.value = '';
  }
});
chat.addEventListener('wheel', e => {
  messageInput.blur();
});
chat.addEventListener('touchstart', e => {
  messageInput.blur();
});
messageInput.addEventListener('blur', e => {
  if (document.body.classList.contains('scroll-mode')) return;
  messageInput.blur();
  document.body.classList.add('scroll-mode');
  chat.scrollTo(0, chat.scrollHeight);
});
messageInput.addEventListener('focus', e => {
  document.body.classList.remove('scroll-mode');
});
const illegalNameCharsRegex = /[^a-z ]/i;
// https://www.materialui.co/flatuicolors
const nameColours = {
  teal: '#1abc9c', green: '#2ecc71', blue: '#3498db', purple: '#9b59b6',
  yellow: '#f1c40f', orange: '#e67e22', red: '#e74c3c', white: '#ecf0f1',
  grey: '#95a5a6', gray: '#95a5a6', black: '#34495e'
};
async function launchChat(chatGetter) {
  document.body.classList.add('chat-mode');
  let messages, userData;
  function createMessage({type, content, author, time, data}) {
    if (!data) data = {};
    const message = document.createElement('div');
    message.classList.add('message');
    if (type === 'message') {
      message.classList.add('normal');
      const authorSpan = document.createElement('span');
      authorSpan.classList.add('author');
      authorSpan.textContent = userData[author] ? userData[author].name : '[deleted user]';
      if (userData[author]) authorSpan.style.color = userData[author].colour;
      message.appendChild(authorSpan);
      message.appendChild(document.createTextNode(': '));
    } else if (type === 'announcement') {
      message.classList.add('announcement');
    } else if (type === 'self-message') {
      message.classList.add('self-message');
    }
    const contentSpan = document.createElement('span');
    contentSpan.classList.add('content');
    contentSpan.textContent = decodeURIComponent(content);
    if (data.italics) contentSpan.classList.add('italics');
    message.appendChild(contentSpan);
    return message;
  }
  function submitHandler(msg) {
    if (msg[0] === '/') {
      if (msg[1] === '/') obj.send(msg.slice(1));
      else {
        const command = msg.slice(1).split(' ')[0];
        switch (command) {
          case 'help': {
            selfPost('/help - Lista de comandos\n'
              + '//[resto da mensagem] - Envia a mensagem começando com uma única barra (escapa do comando)\n'
              + '/setname [nome] - Muda seu nome para seus colegas :D (outro: /nick)\n'
              + '/setcolour [nome da cor] - Muda a cor do seu nome #estilo. (aliases: /setcolor, /colour)\n'
              + '/me [mensagem] - Deixa sua mensagem em itálico.');
            break;
          }
          case 'setname': case 'nick': {
            const name = msg.slice(1 + command.length + 1);
            if (!name) selfPost('Os nomes devem ter entre 3 e 20 caracteres e podem conter apenas letras e espaços.');
            else if (name.length < 3) selfPost('Nome muito curto! (min 3 letras) #minimalista.');
            else if (name.length > 20) selfPost('Nome muito grande! (máximo: 20 letras).');
            else if (name.includes('  ')) selfPost('O nome tem mais de um espaço em uma linha.');
            else if (illegalNameCharsRegex.test(name)) selfPost('O nome tem caracteres indesejáveis!');
            else obj.setName(name);
            break;
          }
          case 'setcolour': case 'setcolor': case 'colour': {
            const colour = msg.slice(1 + command.length + 1);
            if (nameColours[colour]) {
              obj.setColour(nameColours[colour]);
              selfPost('Cor do nome mudado para ' + colour);
            }
            else selfPost('Cores: ' + Object.keys(nameColours).join(', '));
            break;
          }
          case 'me': {
            const message = msg.slice(1 + command.length + 1);
            if (message) {
              obj.send(message, {italics: true});
            }
            break;
          }
          default:
            selfPost('Comando desconhecido. (use a barra dupla para fugir de um comando)');
        }
      }
    } else {
      obj.send(msg);
    }
  }
  const obj = await chatGetter({
    initialize(msgs, ud) {
      chat.innerHTML = '';
      messages = msgs;
      userData = ud;
      const fragment = document.createDocumentFragment();
      messages.forEach(msg => fragment.appendChild(createMessage(msg)));
      chat.appendChild(fragment);
      selfPost('Olá! Digite /help para uma lista de comandos legais :)\n'
        + 'AVISO: Qualquer coisa que seja falada, ou postada aqui como: linguagem inapropriada, material nocivo, conteúdos +18, spam, entre outros, NÃO SÃO DE RESPONSABILIDADE DOS MODERADORES, E CRIADORES DA SHURIKEN.');
    },
    message(msg) {
      chat.appendChild(createMessage(msg));
    },
    close() {
      onsubmit = null;
      messageInput.disabled = true;
      chat.appendChild(hostClosedMessage);
    },
    reopen() {
      onsubmit = submitHandler;
      messageInput.disabled = false;
      chat.removeChild(hostClosedMessage);
    }
  });
  const hostClosedMessage = document.createElement('div');
  hostClosedMessage.classList.add('message');
  const hostClosedContent = document.createElement('span');
  hostClosedContent.classList.add('content');
  hostClosedContent.textContent = 'Parece que o host do bate-papo saiu :O, assumir o controle?';
  hostClosedMessage.appendChild(hostClosedContent);
  const hostClosedBtn = document.createElement('button');
  hostClosedBtn.classList.add('chat-btn');
  hostClosedBtn.textContent = 'Sim';
  hostClosedBtn.addEventListener('click', e => {
    const messagesClone = JSON.parse(JSON.stringify(messages));
    const userDataClone = JSON.parse(JSON.stringify(userData));
    messagesClone.push({
      type: 'announcement',
      content: encodeURIComponent(`Host transferido para ${userData[obj.myID].name}.`),
      time: Date.now()
    });
    const newID = SHU_PREFIX + obj.id;
    userDataClone[newID] = userDataClone[obj.myID];
    delete userDataClone[obj.myID];
    messagesClone.forEach(msg => {
      if (msg.author === obj.myID) msg.author = newID;
      else if (msg.author === newID) msg.author = 'was-' + newID;
    });
    launchChat(listeners => createChat(listeners, obj.id, messagesClone, userDataClone))
      .catch(err => {
        console.log(err);
        selfPost('Ocorreu um problema ao assumir o controle.');
      });
    obj.destroy();
  });
  hostClosedMessage.appendChild(hostClosedBtn);
  window.history.pushState({}, '', '?chat=' + obj.id);
  onsubmit = submitHandler;
  messageInput.disabled = false;
  messageInput.focus();
  function selfPost(msg) {
    chat.appendChild(createMessage({type: 'self-message', content: encodeURIComponent(msg), time: Date.now()}));
  }
}
document.getElementById('create').addEventListener('click', e => {
  launchChat(listeners => createChat(listeners))
    .catch(err => {
      document.body.classList.remove('chat-mode');
      window.history.pushState({}, '', window.location.pathname);
      console.log(err);
    });
});
const joinID = document.getElementById('join-id');
const idError = document.getElementById('id-error');
const idRegex = /[a-z]{6,9}/;
document.getElementById('join').addEventListener('click', e => {
  const id = joinID.value.toLowerCase();
  if (idRegex.test(id))
    launchChat(listeners => joinChat(id, listeners))
      .catch(err => {
        idError.textContent = 'Problema ao conectar-se à sala :(';
        idError.classList.remove('hidden');
        document.body.classList.remove('chat-mode');
        window.history.pushState({}, '', window.location.pathname);
        console.log(err);
      });
  else {
    idError.textContent = 'Isso não tem nada a ver com um ID de bate-papo.';
    idError.classList.remove('hidden');
  }
});
const params = new URL(window.location).searchParams;
if (params.get('chat')) {
  const id = params.get('chat');
  if (idRegex.test(id)) {
    launchChat(listeners => joinChat(id, listeners))
      .catch(() => launchChat(listeners => createChat(listeners, id)))
        .catch(err => {
          document.body.classList.remove('chat-mode');
          window.history.pushState({}, '', window.location.pathname);
          console.log(err);
        });
  }
}
