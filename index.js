const WebSocket = require('ws');
const fetch = require('node-fetch');

const OPENAI_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03'; // OpenAI Realtime endpoint
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'JOUW_OPENAI_API_KEY_HIER';

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });
console.log("WebSocket proxy gestart op poort", process.env.PORT || 3000);

server.on('connection', (clientWs) => {
    console.log("Nieuwe Unity client verbonden");

    // OpenAI connectie
    const aiWs = new WebSocket(OPENAI_WS_URL, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            // Voeg extra headers toe als nodig (bv. JWT!)
        }
    });

    // Proxy berichten van client → AI
    clientWs.on('message', (msg) => {
        if (aiWs.readyState === WebSocket.OPEN) {
            aiWs.send(msg);
        } else {
            // Buffer eventueel tot open?
        }
    });

    // Proxy berichten van AI → client
    aiWs.on('message', (msg) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(msg);
        }
    });

    aiWs.on('open', () => {
        console.log("OpenAI verbinding is open");
        // Eventueel kun je meteen een start-prompt sturen
    });

    aiWs.on('close', () => {
        console.log("OpenAI ws gesloten");
        clientWs.close();
    });

    aiWs.on('error', (err) => {
        console.error("OpenAI ws error:", err);
        clientWs.close();
    });

    clientWs.on('close', () => {
        console.log("Unity client gesloten");
        aiWs.close();
    });

    clientWs.on('error', (err) => {
        console.error("Unity ws error:", err);
        aiWs.close();
    });
});
