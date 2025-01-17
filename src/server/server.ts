import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
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