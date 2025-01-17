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

// Keep track of all connected players and their positions
const players = new Map();

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Store new player
    players.set(socket.id, {
        id: socket.id,
        position: { x: 0, y: 0.5, z: 0 }
    });

    // Send existing players to the new player
    players.forEach((player) => {
        if (player.id !== socket.id) {
            socket.emit('playerJoined', player.id);
            socket.emit('playerMoved', {
                id: player.id,
                position: player.position
            });
        }
    });

    // Broadcast to other players that a new player has joined
    socket.broadcast.emit('playerJoined', socket.id);

    // Handle player movement
    socket.on('move', (position) => {
        // Update player position
        if (players.has(socket.id)) {
            players.get(socket.id).position = position;
        }
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            position
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
}); 