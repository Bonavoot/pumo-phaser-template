import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import io from "socket.io-client";

export class FightingGame extends Scene {
    constructor() {
        super("FightingGame");
        this.player = null;
        this.opponent = null;
        this.keys = null;
        this.speed = 250;
        this.socket = null;
        this.matchId = null;
        this.playerNumber = null;
        this.gameStarted = false;
        this.waitingText = null;
        this.isMoving = false;
    }

    init(data) {
        // Initialize with any data passed from the menu
        this.playerName = data.playerName || "Player";
    }

    create() {
        // Setup game area
        this.cameras.main.setBackgroundColor(0x222222);

        // Add background - a simple fighting arena
        const background = this.add.rectangle(512, 384, 1024, 768, 0x333333);

        // Add floor/platform
        const floor = this.add
            .rectangle(512, 550, 800, 30, 0x555555)
            .setStrokeStyle(2, 0x888888);

        // Display waiting message
        this.waitingText = this.add
            .text(512, 300, "Finding opponent...", {
                fontFamily: "Arial Black",
                fontSize: 32,
                color: "#ffffff",
                align: "center",
            })
            .setOrigin(0.5);

        // Connect to socket server with explicit URL
        this.socket = io("http://localhost:3000", {
            withCredentials: true,
            transports: ["websocket", "polling"],
        });

        // Add connection event handlers
        this.socket.on("connect", () => {
            console.log("Connected to server with ID:", this.socket.id);

            // Add debug text to show connection
            this.add
                .text(512, 240, "Connected to server!", {
                    fontFamily: "Arial",
                    fontSize: 20,
                    color: "#00ff00",
                    align: "center",
                })
                .setOrigin(0.5);

            // Request to find a match
            this.socket.emit("findMatch");
        });

        this.socket.on("connect_error", (error) => {
            console.error("Connection error:", error);

            // Show error message on screen
            this.waitingText.setText(
                "Connection error!\nCheck console for details"
            );
            this.waitingText.setColor("#ff0000");
        });

        this.setupSocketListeners();

        // Set up input controls
        this.keys = {
            w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        EventBus.emit("current-scene-ready", this);
    }

    setupSocketListeners() {
        // Waiting for opponent
        this.socket.on("waitingForOpponent", () => {
            console.log("Waiting for opponent...");
            this.waitingText.setText("Waiting for an opponent...");
        });

        // Match found
        this.socket.on("matchFound", (matchData) => {
            console.log("Match found!", matchData);
            this.matchId = matchData.matchId;
            this.playerNumber = matchData.playerNumber;
            this.opponentId = matchData.opponentId;

            // Remove waiting text
            this.waitingText.destroy();

            // Show match info
            this.add
                .text(
                    512,
                    50,
                    `Match Started - You are Player ${this.playerNumber}`,
                    {
                        fontFamily: "Arial Black",
                        fontSize: 24,
                        color: "#ffffff",
                        align: "center",
                    }
                )
                .setOrigin(0.5);

            // Create player and opponent
            this.createFighters(matchData.initialState);

            // Match is ready to play
            this.gameStarted = true;
        });

        // Opponent moved
        this.socket.on("opponentMoved", (moveData) => {
            if (this.opponent) {
                this.opponent.x = moveData.x;
                this.opponent.y = moveData.y;

                // Handle facing direction
                if (moveData.facing === "left") {
                    this.opponent.setFlipX(true);
                } else {
                    this.opponent.setFlipX(false);
                }

                // Play animation if opponent is moving
                const wasMoving = this.opponent.isMoving;
                this.opponent.isMoving = true;

                if (!wasMoving) {
                    this.opponent.play("player_move");
                }

                // Set a short timer to stop animation if no updates come
                if (this.opponent.moveTimer)
                    clearTimeout(this.opponent.moveTimer);
                this.opponent.moveTimer = setTimeout(() => {
                    this.opponent.isMoving = false;
                    this.opponent.stop();
                    this.opponent.setFrame(0);
                }, 100);
            }
        });

        // Opponent disconnected
        this.socket.on("opponentDisconnected", () => {
            console.log("Opponent disconnected!");
            // Show disconnection message
            this.add
                .text(512, 200, "Opponent disconnected!", {
                    fontFamily: "Arial Black",
                    fontSize: 32,
                    color: "#ff0000",
                    align: "center",
                })
                .setOrigin(0.5);

            // Optional: Return to menu after a delay
            this.time.delayedCall(3000, () => {
                if (this.socket) this.socket.disconnect();
                this.scene.start("MainMenu");
            });
        });
    }

    createFighters(initialState) {
        // Create animations if they don't exist
        if (!this.anims.exists("player_move")) {
            this.anims.create({
                key: "player_move",
                frames: this.anims.generateFrameNumbers("player", {
                    start: 0,
                    end: 13, // Adjust based on your spritesheet
                }),
                frameRate: 30,
                repeat: -1,
            });
        }

        // Determine which player state to use based on player number
        const playerState =
            this.playerNumber === 1
                ? initialState.player1
                : initialState.player2;
        const opponentState =
            this.playerNumber === 1
                ? initialState.player2
                : initialState.player1;

        // Create the player
        this.player = this.add.sprite(playerState.x, playerState.y, "player");
        this.player.setFrame(0); // Set initial frame
        this.player.setScale(0.75);

        // Create the opponent
        this.opponent = this.add.sprite(
            opponentState.x,
            opponentState.y,
            "player"
        );
        this.opponent.setFrame(0);
        this.opponent.isMoving = false; // Track opponent animation state
        this.opponent.setScale(0.75);

        // Set initial facing direction
        if (playerState.facing === "left") {
            this.player.setFlipX(true);
        }

        if (opponentState.facing === "left") {
            this.opponent.setFlipX(false);
        }

        // Set player tint to distinguish from opponent
        this.player.setTint(0x0088ff); // Blue tint
        this.opponent.setTint(0xff5500); // Orange tint
    }

    update() {
        if (!this.gameStarted || !this.player) return;

        // Reset movement
        let dx = 0;
        let dy = 0;
        let facing = this.player.flipX ? "left" : "right";

        // Handle horizontal movement
        if (this.keys.a.isDown) {
            dx = -this.speed;
            facing = "right";
            this.player.setFlipX(false);
        } else if (this.keys.d.isDown) {
            dx = this.speed;
            facing = "left";
            this.player.setFlipX(true);
        }

        // Check if player is moving
        const isNowMoving = dx !== 0 || dy !== 0;

        // Handle animation state changes
        if (isNowMoving && !this.isMoving) {
            // Started moving - play animation
            this.player.play("player_move");
            this.isMoving = true;
        } else if (!isNowMoving && this.isMoving) {
            // Stopped moving - stop animation and show idle frame
            this.player.stop();
            this.player.setFrame(0); // Show first frame when idle
            this.isMoving = false;
        }

        // Apply movement (delta time based)
        const dt = this.sys.game.loop.delta / 1000; // Convert to seconds
        this.player.x += dx * dt;
        this.player.y += dy * dt;

        // Basic boundaries (can be replaced with platform physics in a real fighting game)
        this.player.x = Phaser.Math.Clamp(this.player.x, 50, 974);
        this.player.y = Phaser.Math.Clamp(this.player.y, 50, 520); // Above floor

        // Send position update to server if moving or direction changed
        if (isNowMoving || this.lastFacing !== facing) {
            this.socket.emit("playerMovement", {
                matchId: this.matchId,
                playerNumber: this.playerNumber,
                x: this.player.x,
                y: this.player.y,
                facing: facing,
            });

            this.lastFacing = facing;
        }
    }

    // Clean up when leaving scene
    shutdown() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

