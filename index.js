const WebSocket = require('ws');
const MODEL_ID = process.env.MODEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

if (!MODEL_ID || !OPENAI_API_KEY) {
  throw new Error('MODEL_ID of OPENAI_API_KEY mist! Check je environment variables.');
}

wss.on('connection', function connection(clientWs) {
  console.log("Nieuwe Unity client verbonden");

  // Create OpenAI WS connection when a Unity client connects
  const openAIWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL_ID}`, {
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  // Buffer messages from Unity until OpenAI WS is open
  const pendingMessages = [];
  let openAIReady = false;

  openAIWs.on('open', () => {
    console.log("OpenAI connection is open");
    openAIReady = true;
    // Flush any buffered Unity messages
    for (const msg of pendingMessages) {
      openAIWs.send(msg);
    }
    pendingMessages.length = 0;
  });

  // Relay messages from Unity to OpenAI
clientWs.on('message', (data) => {
  if (!openAIReady) {
    console.log("AI WebSocket not yet open, buffering Unity message");
    pendingMessages.push(data);
  } else {
    // Forward Unity's message to OpenAI
    openAIWs.send(data);
    console.log(`Bericht van Unity naar OpenAI (lengte ${data.length})`);
  }
}); 

  // Relay messages from OpenAI to Unity
  openAIWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
      console.log(`Bericht van OpenAI naar Unity (lengte ${data.length})`);
    }
  });

  // Handle OpenAI socket closing
  openAIWs.on('close', (code, reason) => {
    console.log(`OpenAI ws gesloten. Code: ${code}, reden: ${reason || 'geen'}`);
    // If OpenAI closed first unexpectedly, inform Unity or close Unity socket
    if (clientWs.readyState === WebSocket.OPEN) {
      // You can either close the Unity socket or send an error message
      clientWs.close(1000, "OpenAI session ended");  // normal closure
    }
  });

  openAIWs.on('error', (err) => {
    console.error("OpenAI WS error:", err);
    // Possibly forward an error to Unity or close connections
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, "OpenAI error");  // 1011 = internal error
    }
  });

  // Handle Unity socket closing
  clientWs.on('close', () => {
    console.log("Unity client gesloten.");
    // Close OpenAI socket if it's still open
    if (openAIWs.readyState === WebSocket.OPEN || openAIWs.readyState === WebSocket.CONNECTING) {
      openAIWs.close(1000);  // normal closure
    }
  });

});
