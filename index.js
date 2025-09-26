const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('start-run', (data) => {
        console.log('Run started by user:', data.userId);
        socket.broadcast.emit('run-started', data);
    });

    socket.on('location-update', (data) => {
        socket.broadcast.emit('location-updated', data);
    });

    socket.on('stop-run', (data) => {
        console.log('Run stopped by user:', data.userId);
        socket.broadcast.emit('run-stopped', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});