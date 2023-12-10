const fs = require('fs');
const io = require('socket.io-client');
const fetch = require('node-fetch');

// Declare an object to store socket connections
const sockets = {};

async function getSocketTokenAndUserID(token) {
  try {
    const response = await fetch("https://www.itemsatis.com/api/checkLogin", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `token=${token}`,
    });

    const data = await response.json();

    if (data.success) {
      const SocketToken = data.SocketToken;
      const YourUserID = data.result.Id;
      const YourUserName = data.result.UserName;

      // Update config.json with the new values
      const config = {
        YourUserID,
        YourUserName,
        SocketToken,
      };

      const sanitizedToken = Buffer.from(token).toString('base64');
      const configPath = `configs/config_${sanitizedToken}.json`;

      // Create configs folder if it doesn't exist
      if (!fs.existsSync('configs')) {
        fs.mkdirSync('configs');
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      // Log the connection to the console
      console.log(`Socket Sistemine Bağlandı - Token: ${token}`);

      // Start socket connection and message sending
      socket = startSocket(SocketToken, YourUserID, YourUserName, sanitizedToken);
    } else {
      console.error(`API Error for token ${token}:`, data.message);
    }
  } catch (error) {
    console.error(`Error fetching data from API for token ${token}:`, error);
  }
}

// Function to start socket connection
function startSocket(SocketToken, YourUserID, YourUserName, sanitizedToken) {
  // Close the existing socket connection if it already exists
  if (sockets[sanitizedToken]) {
    sockets[sanitizedToken].disconnect();
  }

  const userData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  let index = 0;

  // Read the last index from the file or start from 0
  try {
    const lastIndexPath = `configs/lastIndex_${sanitizedToken}.txt`;
    const lastIndex = fs.readFileSync(lastIndexPath, 'utf8');
    if (!isNaN(lastIndex)) {
      index = parseInt(lastIndex, 10);
    }
  } catch (error) {
    // Ignore error, start from 0 if the file doesn't exist
  }

  const options = {
    agent: false,
    closeOnBeforeunload: true,
    hostname: "chat.itemsatis.com",
    path: "/socket.io/",
    perMessageDeflate: { threshold: 1024 },
    port: 443,
    query: {
      userData: SocketToken,
      EIO: 4,
      transport: ["websocket", "polling"],
    },
    rejectUnauthorized: true,
    rememberUpgrade: true,
    secure: true,
    timestampParam: "t",
    transportOptions: {},
    upgrade: true,
    withCredentials: false,
  };

  // Connect to the socket using the dynamic values
  const socket = io.connect("https://chat.itemsatis.com", options);
  console.log(socket);

  // Store the socket connection in the object
  sockets[sanitizedToken] = socket;

  socket.on('connect', () => {
    console.log('Socket Sistemine Bağlandı.');

    function sendNextMessage() {
      if (index < userData.length) {
        const user = userData[index];
        const toUserID = user.toUserID;
        const toUserName = user.toUserName;
        const messageToSend = "sakin ol, sadece test yapıyorum.";

        // Log the token and line number
        console.log(`Sent message to ${toUserName} (ID: ${toUserID}): ${messageToSend}, Token Line: ${index + 1}`);

        // Use YourUserName here
        sendMessage(socket, messageToSend, toUserName, YourUserName, toUserID, YourUserID);

        index++;

        setTimeout(sendNextMessage, 4000);

        // Update the last index in the file
        fs.writeFileSync(`configs/lastIndex_${sanitizedToken}.txt`, index.toString(), 'utf8');
      }
    }

    // Start sending messages
    sendNextMessage();
  });

  // ... (rest of your socket-related code)

  socket.on('disconnect', () => {
    console.log(`Socket Sisteminin Bağlantısı Koptu - Yeniden Bağlanılıyor.`);
    socket.open();
  });

  socket.on('connect_error', (error) => {
    console.log(`Socket Sisteminin Bağlantısı Koptu `, error);
    socket.open();
  });

  socket.on('connect_timeout', () => {
    console.log(`Socket Bağlantısı Zaman Aşımına Uğradı  Yeniden Bağlanılıyor.`);
    socket.open();
  });

  socket.on('error', (error) => {
    console.log(`Hata - Token: ${token}:`, error);
    socket.open();
  });

  // Handle socket reconnect on credentials change
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Socket Yeniden Bağlanıyor Deneme: ${attemptNumber}`);
    socket.disconnect(true);
    startSocket(SocketToken, YourUserID, YourUserName, sanitizedToken);
  });

  return socket; // Return the socket object
}

// Function to send a message
function sendMessage(socket, message, toUserName, userName, toUserID, userID) {
  socket.emit('sendMessage', message, toUserName, userName, toUserID, userID);
}

function processTokens() {
  try {
    const tokens = fs.readFileSync('tokens.txt', 'utf8').split('\n').filter(Boolean);

    tokens.forEach(async (token) => {
      const sanitizedToken = Buffer.from(token).toString('base64');

      // Initial check when the script starts
      await getSocketTokenAndUserID(token);

      // Start a periodic check every 5 minutes
      setInterval(async () => {
        await getSocketTokenAndUserID(token);
      }, 5 * 60 * 1000); // 5 minutes interval
    });
  } catch (error) {
    console.error('Error reading tokens from file:', error);
  }
}

// Initial check and start the process
processTokens();
