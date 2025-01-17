"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
// Serve static files from dist directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../../dist')));
// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../dist/index.html'));
});
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    // Broadcast to other players that a new player has joined
    socket.broadcast.emit('playerJoined', socket.id);
    // Handle player movement
    socket.on('move', (position) => {
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            position
        });
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        io.emit('playerLeft', socket.id);
    });
});
httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
});
//# sourceMappingURL=server.js.map