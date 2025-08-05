const WebSocket = require('ws');
const fetch = require('node-fetch');

const OPENAI_WS_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03'; // OpenAI Realtime endpoint
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'JOUW_OPENAI_API_KEY_HIER';

const server = new WebSocket.Server({ port: process.env.PORT || 3000 });
console.log("WebSocket proxy gestart op poort", process.env.PORT || 3000);

server.on('connection', (clientWs) => {
    console.log("Nieuwe Unity client verbonden");
    console.log(`Client WS readyState: ${clientWs.readyState}`);

    const aiWs = new WebSocket(OPENAI_WS_URL, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
        }
    });

    let messageBuffer = [];

    aiWs.on('open', () => {
        console.log("OpenAI verbinding is open");
        console.log(`AI WS readyState: ${aiWs.readyState}`);

        // Stuur alle gebufferde berichten nu door
        messageBuffer.forEach(msg => {
            aiWs.send(msg, err => {
                if (err) console.error("Fout bij versturen buffered bericht:", err.stack || err);
            });
        });
        messageBuffer = [];
    });

    clientWs.on('message', (msg) => {
        console.log(`Bericht van Unity naar OpenAI (lengte ${msg.length})`);
        if (aiWs.readyState === WebSocket.OPEN) {
            aiWs.send(msg, err => {
                if (err) console.error("Fout bij versturen naar OpenAI:", err.stack || err);
                else console.log("Bericht succesvol doorgestuurd naar OpenAI");
            });
        } else {
            console.log(`AI WebSocket nog niet open (readyState: ${aiWs.readyState}), bericht gebufferd.`);
            messageBuffer.push(msg);
        }
    });

    // Proxy berichten van AI → client
    aiWs.on('message', (msg) => {
        console.log(`Bericht van OpenAI naar Unity (lengte ${msg.length})`);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(msg, (err) => {
                if (err) {
                    console.error("Fout bij versturen naar Unity client:", err.stack || err);
                } else {
                    console.log("Bericht succesvol doorgestuurd naar Unity client");
                }
            });
        } else {
            console.warn(`Client WebSocket niet open (readyState: ${clientWs.readyState}), bericht niet verzonden.`);
        }
    });

    aiWs.on('close', (code, reason) => {
        console.log(`OpenAI ws gesloten. Code: ${code}, reden: ${reason}`);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code, reason);
        }
    });

    aiWs.on('error', (err) => {
        console.error("OpenAI ws error:", err.stack || err);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });

    clientWs.on('close', (code, reason) => {
        console.log(`Unity client gesloten. Code: ${code}, reden: ${reason}`);
        if (aiWs.readyState === WebSocket.OPEN) {
            aiWs.close(code, reason);
        }
    });

    clientWs.on('error', (err) => {
        console.error("Unity ws error:", err.stack || err);
        if (aiWs.readyState === WebSocket.OPEN) {
            aiWs.close();
        }
    });
});
