// server/index.js
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// 현재 모듈의 디렉토리 경로를 가져옵니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// React 앱의 정적 파일을 제공
app.use(express.static(path.join(__dirname, '../dist')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'join_room':
                ws.room = data.roomName;
                ws.send(JSON.stringify({ type: 'welcome' }));
                break;
            case 'offer':
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.room === ws.room) {
                        client.send(JSON.stringify({ type: 'offer', offer: data.offer }));
                    }
                });
                break;
            case 'answer':
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.room === ws.room) {
                        client.send(JSON.stringify({ type: 'answer', answer: data.answer }));
                    }
                });
                break;
            case 'ice':
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN && client.room === ws.room) {
                        client.send(JSON.stringify({ type: 'ice', ice: data.ice }));
                    }
                });
                break;
        }
    });
});

// const PORT = process.env.PORT || 3000;
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
