const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(
    cors({
        origin: "http://localhost:8080", // Your Vite dev server
        credentials: true,
    })
);

// Initialize Socket.io with CORS options
const io = new Server(server, {
    cors: {
        origin: "http://localhost:8080", // Your Vite dev server
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, "dist")));

// Simple route for the home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Game state
const waitingPlayers = [];
const matches = {};

// Socket.io connection handler
io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // Player looking for a match
    socket.on("findMatch", () => {
        console.log(`Player ${socket.id} looking for a match`);

        if (waitingPlayers.length > 0) {
            // Match with a waiting player
            const opponent = waitingPlayers.shift();
            const matchId = `match_${Date.now()}`;

            // Create match data
            matches[matchId] = {
                players: [socket.id, opponent],
                state: {
                    player1: {
                        id: opponent,
                        x: 200,
                        y: 450,
                        facing: "right",
                    },
                    player2: {
                        id: socket.id,
                        x: 800,
                        y: 450,
                        facing: "left",
                    },
                },
            };

            // Notify both players
            io.to(opponent).emit("matchFound", {
                matchId,
                playerId: opponent,
                playerNumber: 1,
                opponentId: socket.id,
                initialState: matches[matchId].state,
            });

            socket.emit("matchFound", {
                matchId,
                playerId: socket.id,
                playerNumber: 2,
                opponentId: opponent,
                initialState: matches[matchId].state,
            });

            // Join both players to a room
            socket.join(matchId);
            io.sockets.sockets.get(opponent)?.join(matchId);

            console.log(
                `Match created: ${matchId} between ${opponent} and ${socket.id}`
            );
        } else {
            // Add to waiting list
            waitingPlayers.push(socket.id);
            socket.emit("waitingForOpponent");
            console.log(`Player ${socket.id} added to waiting list`);
        }
    });

    // Player movement
    socket.on("playerMovement", (data) => {
        if (!data || !data.matchId) return;

        const { matchId, playerNumber, x, y, facing, isMoving } = data;

        if (matches[matchId]) {
            const playerKey = playerNumber === 1 ? "player1" : "player2";
            const matchState = matches[matchId].state;

            // Update state with all received properties
            matchState[playerKey].x = x;
            matchState[playerKey].y = y;

            if (facing !== undefined) {
                matchState[playerKey].facing = facing;
            }

            // Store isMoving state in the match data
            matchState[playerKey].isMoving = isMoving;

            // Forward complete movement data to opponent
            socket.to(matchId).emit("opponentMoved", {
                x,
                y,
                facing,
                isMoving,
            });
        }
    });

    // Player attack
    socket.on("playerAttack", (data) => {
        if (!data || !data.matchId) return;

        const { matchId, playerNumber } = data;

        if (matches[matchId]) {
            console.log(
                `Player ${playerNumber} in match ${matchId} is attacking`
            );

            // Forward attack info to opponent
            socket.to(matchId).emit("opponentAttack");
        }
    });

    socket.on("playerKnockback", (data) => {
        if (!data || !data.matchId) return;

        const { matchId, playerNumber } = data;

        if (matches[matchId]) {
            console.log(
                `Player ${playerNumber} in match ${matchId} is being knocked back`
            );

            // Forward knockback physics data to opponent
            socket.to(matchId).emit("opponentKnockback", {
                velocityX: data.velocityX,
                velocityY: data.velocityY,
            });
        }
    });

    // Player hit (for visual feedback)
    socket.on("playerHit", (data) => {
        if (!data || !data.matchId) return;

        const { matchId } = data;

        if (matches[matchId]) {
            // Forward hit event to opponent
            socket.to(matchId).emit("playerHit");
        }
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);

        // Remove from waiting list
        const waitingIndex = waitingPlayers.indexOf(socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }

        // Check if in a match
        for (const matchId in matches) {
            const match = matches[matchId];
            if (match.players.includes(socket.id)) {
                // Notify other player
                const opponentId = match.players.find((id) => id !== socket.id);
                if (opponentId) {
                    io.to(opponentId).emit("opponentDisconnected");
                }
                delete matches[matchId];
                break;
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

