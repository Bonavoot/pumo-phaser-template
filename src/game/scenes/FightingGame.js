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

        // Add background - a sumo arena (dohyo)
        this.add.image(512, 384, "sumo-arena").setScale(1.5);

        // Add floor/platform (invisible)
        const floor = this.add
            .rectangle(512, 550, 800, 30, 0x555555)
            .setStrokeStyle(2, 0x888888)
            .setAlpha(0);

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
            a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            space: this.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            ),
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

                // Always face the player
                this.updateFacingDirection();

                // Play animation if opponent is moving
                if (moveData.isMoving && !this.opponent.isMoving) {
                    this.opponent.play("player_move");
                    this.opponent.isMoving = true;
                } else if (!moveData.isMoving && this.opponent.isMoving) {
                    this.opponent.stop();
                    this.opponent.setFrame(0);
                    this.opponent.isMoving = false;
                }
            }
        });

        // Opponent attack
        this.socket.on("opponentAttack", () => {
            if (this.opponent) {
                // Play attack animation
                this.opponent.play("player_attack");

                // Check if player is close enough to be hit
                const distance = Phaser.Math.Distance.Between(
                    this.player.x,
                    this.player.y,
                    this.opponent.x,
                    this.opponent.y
                );

                if (distance < 150) {
                    // Determine knockback direction
                    const direction = this.player.x < this.opponent.x ? -1 : 1;

                    // Apply knockback
                    this.player.x += direction * 100;

                    // Visual feedback - flash red
                    this.player.setTint(0xff0000);
                    this.time.delayedCall(200, () => {
                        this.player.clearTint();
                        this.player.setTint(0x0088ff);
                    });
                }
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
        this.anims.create({
            key: "player_move",
            frames: this.anims.generateFrameNumbers("player", {
                start: 0,
                end: 13,
            }),
            frameRate: 24,
            repeat: -1,
        });

        this.anims.create({
            key: "player_attack",
            frames: this.anims.generateFrameNumbers("slap1", {
                start: 0,
                end: 1,
            }),
            frameRate: 1,
            repeat: 0,
        });

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
        this.player.isMoving = false;
        this.player.isAttacking = false;

        // Create the opponent
        this.opponent = this.add.sprite(
            opponentState.x,
            opponentState.y,
            "player"
        );
        this.opponent.setFrame(0);
        this.opponent.isMoving = false;
        this.opponent.isAttacking = false;
        this.opponent.setScale(0.75);

        // Set player tint to distinguish from opponent
        this.player.setTint(0x0088ff); // Blue tint
        this.opponent.setTint(0xff5500); // Orange tint

        // Initial facing direction
        this.updateFacingDirection();
    }

    updateFacingDirection() {
        if (this.player && this.opponent) {
            // Simple facing logic - always face each other
            if (this.player.x < this.opponent.x) {
                this.player.setFlipX(true);
                this.opponent.setFlipX(false);
            } else {
                this.player.setFlipX(false);
                this.opponent.setFlipX(true);
            }
        }
    }

    attack() {
        if (this.player.isAttacking) return;

        this.player.isAttacking = true;

        // Play attack animation
        this.player.play("player_attack");

        // Send attack to server
        this.socket.emit("playerAttack", {
            matchId: this.matchId,
            playerNumber: this.playerNumber,
        });

        // Reset after animation completes
        this.time.delayedCall(100, () => {
            this.player.isAttacking = false;
            if (this.player.isMoving) {
                this.player.play("player_move");
            } else {
                this.player.setFrame(0);
            }
        });
    }

    update() {
        if (!this.gameStarted || !this.player) return;

        // Reset movement
        let dx = 0;
        let isNowMoving = false;

        // Allow movement during attack
        if (this.keys.a.isDown) {
            dx = -this.speed;
            isNowMoving = true;
        } else if (this.keys.d.isDown) {
            dx = this.speed;
            isNowMoving = true;
        }

        // Apply movement (delta time based)
        const dt = this.sys.game.loop.delta / 1000; // Convert to seconds
        this.player.x += dx * dt;

        // Check if player is moving and update animation accordingly (but don't interrupt attack)
        if (!this.player.isAttacking) {
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
        }

        // Handle attack input
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            this.attack();
        }

        // Basic boundaries
        this.player.x = Phaser.Math.Clamp(this.player.x, 50, 974);
        this.player.y = Phaser.Math.Clamp(this.player.y, 450, 500); // Above floor

        // Always update facing direction
        this.updateFacingDirection();

        // Send position update to server
        this.socket.emit("playerMovement", {
            matchId: this.matchId,
            playerNumber: this.playerNumber,
            x: this.player.x,
            y: this.player.y,
            isMoving: this.isMoving,
        });
    }

    // Clean up when leaving scene
    shutdown() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

