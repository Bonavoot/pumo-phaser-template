import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import io from "socket.io-client";

export class FightingGame extends Scene {
    constructor() {
        super("FightingGame");
        this.player = null;
        this.opponent = null;
        this.keys = null;
        this.speed = 300;
        this.socket = null;
        this.matchId = null;
        this.playerNumber = null;
        this.gameStarted = false;
        this.waitingText = null;
        this.isMoving = false;

        // Enhanced knockback physics parameters
        this.knockbackForce = 200;
        this.knockbackDamping = 0.92;
        this.gravity = 0;

        // Performance optimization
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 60;

        // Fixed world dimensions (these will be the same for all players)
        this.worldWidth = 1024;
        this.worldHeight = 768;

        // Ring boundaries will be set in create() based on world dimensions
        this.ringLeft = 0;
        this.ringRight = 0;
        this.ringTop = 0;
        this.ringBottom = 0;
    }

    init(data) {
        // Initialize with any data passed from the menu
        this.playerName = data.playerName || "Player";
    }

    create() {
        // Setup game area
        this.cameras.main.setBackgroundColor(0x1a1a1a);

        // Set ring boundaries based on world dimensions
        const margin = 50;
        this.ringLeft = margin;
        this.ringRight = this.worldWidth - margin;
        this.ringTop = this.worldHeight * 0.6;
        this.ringBottom = this.worldHeight / 2;

        // Create the arena background
        this.arenaBackground = this.add.image(
            this.worldWidth / 2,
            this.worldHeight / 2,
            "sumo-arena"
        );
        this.arenaBackground.setDisplaySize(this.worldWidth, this.worldHeight);

        // Add traditional Japanese-style waiting message
        this.waitingText = this.add
            .text(
                this.worldWidth / 2,
                this.worldHeight / 2,
                "対戦相手を待っています...",
                {
                    fontFamily: "Arial Black",
                    fontSize: 32,
                    color: "#ffffff",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 4,
                }
            )
            .setOrigin(0.5);

        // Add resize listener
        this.scale.on("resize", this.resizeGame, this);

        // Set up the camera to show the entire world
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);

        // Initial camera setup
        this.resizeGame();

        // Add floor/platform (invisible)
        const floor = this.add
            .rectangle(
                this.worldWidth / 2,
                this.worldHeight - 50,
                800,
                30,
                0x555555
            )
            .setStrokeStyle(2, 0x888888)
            .setAlpha(0);

        // Connect to socket server with explicit URL
        this.socket = io(
            process.env.NODE_ENV === "development"
                ? "http://localhost:3000"
                : window.location.origin,
            {
                withCredentials: true,
                transports: ["websocket", "polling"],
            }
        );

        // Add connection event handlers
        this.socket.on("connect", () => {
            console.log("Connected to server with ID:", this.socket.id);

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

    resizeGame() {
        // Get the current game size
        const width = this.scale.width;
        const height = this.scale.height;

        // Calculate the scale factor
        const scale = Math.min(
            width / this.worldWidth,
            height / this.worldHeight
        );

        // Update camera zoom
        this.cameras.main.setZoom(scale);

        // Center the camera
        this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);
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

            // Create player and opponent
            this.createFighters(matchData.initialState);

            // Match is ready to play
            this.gameStarted = true;
        });

        // Player got hit - handle the visual feedback for opponent
        this.socket.on("playerHit", () => {
            if (!this.opponent) return;

            this.opponent.setTint(0xff0000);
            this.time.delayedCall(200, () => {
                this.opponent.clearTint();
                this.opponent.setTint(0xff5500); // Return to orange tint
            });
        });

        // Opponent moved - enhanced for precise synchronization
        this.socket.on("opponentMoved", (moveData) => {
            if (!this.opponent) return;

            // Update position with exact coordinates
            this.opponent.x = moveData.x;
            this.opponent.y = moveData.y;

            // Update facing direction
            if (moveData.facing) {
                this.opponent.setFlipX(
                    moveData.facing === "left" ? false : true
                );
            }

            // Handle animation state
            if (this.opponent.isAttacking) return;

            if (moveData.isMoving) {
                if (!this.opponent.anims.isPlaying) {
                    this.opponent.play("player_move", true);
                }
            } else {
                this.opponent.stop();
                this.opponent.setFrame(0);
            }

            // Check for ring-out
            this.checkRingOut(this.opponent);
        });

        // Opponent attack
        this.socket.on("opponentAttack", () => {
            if (!this.opponent) return;

            // Set attacking flag
            this.opponent.isAttacking = true;
            if (!this.opponent.anims) return;

            // Always stop current animation first
            this.opponent.stop();

            // Play attack animation
            this.opponent.play("player_attack");

            // Listen for animation completion with the standard event format
            this.opponent.once("animationcomplete", (animation) => {
                // Only respond to the attack animation completing
                if (animation.key === "player_attack") {
                    this.opponent.isAttacking = false;

                    // Force reset to correct animation state
                    if (this.opponent.isMoving) {
                        this.opponent.play("player_move");
                    } else {
                        // Explicitly stop any animation and set to frame 0
                        this.opponent.stop();
                        this.opponent.setFrame(0);
                    }
                }
            });

            // Handle attack effects (damage, knockback, etc.)
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                this.opponent.x,
                this.opponent.y
            );

            if (distance < 150) {
                // Apply smooth knockback
                this.applyKnockback(this.player, this.opponent);

                // Visual feedback - flash red
                this.player.setTint(0xff0000);
                this.time.delayedCall(200, () => {
                    this.player.clearTint();
                    this.player.setTint(0x0088ff);
                });

                // Emit that we've been hit (for visual feedback only)
                this.socket.emit("playerHit", {
                    matchId: this.matchId,
                    playerNumber: this.playerNumber,
                });
            }
        });

        // Opponent disconnected
        this.socket.on("opponentDisconnected", () => {
            console.log("Opponent disconnected!");
            // Show disconnection message
            this.add
                .text(
                    this.worldWidth / 2,
                    this.worldHeight / 2,
                    "Opponent disconnected!",
                    {
                        fontFamily: "Arial Black",
                        fontSize: 32,
                        color: "#ff0000",
                        align: "center",
                    }
                )
                .setOrigin(0.5);

            // Optional: Return to menu after a delay
            this.time.delayedCall(3000, () => {
                if (this.socket) this.socket.disconnect();
                this.scene.start("MainMenu");
            });
        });
    }

    // New method to apply a smooth physics-based knockback
    applyKnockback(target, source) {
        // Mark the target as being in knockback
        target.isInKnockback = true;
        target.lastKnockbackTime = this.time.now; // Track when knockback started

        // Calculate direction from source to target
        const angle = Phaser.Math.Angle.Between(
            source.x,
            source.y,
            target.x,
            target.y
        );

        // Initialize or reset velocity properties on the target
        target.knockbackVelocityX = Math.cos(angle) * this.knockbackForce * 3.5;
        target.knockbackVelocityY = Math.sin(angle) * this.knockbackForce * 0.1; // Less vertical force

        // If both objects are at the same position, knock back to the left or right
        if (Math.abs(target.x - source.x) < 10) {
            target.knockbackVelocityX =
                (target.flipX ? -1 : 1) * this.knockbackForce * 3.5;
        }

        // Add a small upward force for a slight hop effect
        target.knockbackVelocityY = 0;

        // Tell the server about this knockback immediately
        if (target === this.player) {
            this.socket.emit("playerKnockback", {
                matchId: this.matchId,
                playerNumber: this.playerNumber,
                velocityX: target.knockbackVelocityX,
                velocityY: target.knockbackVelocityY,
                startX: target.x,
                startY: target.y,
                timestamp: this.time.now,
            });
        }
    }

    createFighters(initialState) {
        // Create animations if they don't exist
        if (!this.anims.exists("player_move")) {
            this.anims.create({
                key: "player_move",
                frames: this.anims.generateFrameNumbers("player", {
                    start: 0,
                    end: 13,
                }),
                frameRate: 24,
                repeat: -1,
            });
        }

        if (!this.anims.exists("player_attack")) {
            this.anims.create({
                key: "player_attack",
                frames: this.anims.generateFrameNumbers("slap1", {
                    start: 0,
                    end: 1,
                }),
                frameRate: 30,
                repeat: 0,
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
        this.player = this.add.sprite(playerState.x, this.ringTop, "player");
        this.player.setScale(0.7);
        this.player.setFrame(0);
        this.player.isMoving = false;
        this.player.isAttacking = false;
        this.player.isInKnockback = false;
        this.player.knockbackVelocityX = 0;
        this.player.knockbackVelocityY = 0;

        // Create the opponent
        this.opponent = this.add.sprite(
            opponentState.x,
            this.ringTop,
            "player"
        );
        this.opponent.setScale(0.7);
        this.opponent.setFrame(0);
        this.opponent.isMoving = false;
        this.opponent.isAttacking = false;
        this.opponent.isInKnockback = false;
        this.opponent.knockbackVelocityX = 0;
        this.opponent.knockbackVelocityY = 0;
        this.opponent.setTint(0xff5500); // Orange tint
    }

    updateFacingDirection() {
        if (this.player && this.opponent) {
            // Simple facing logic - always face each other
            if (this.player.x < this.opponent.x) {
                this.player.setFlipX(true); // facing right
                this.opponent.setFlipX(false); // facing left
            } else {
                this.player.setFlipX(false); // facing left
                this.opponent.setFlipX(true); // facing right
            }
        }
    }

    attack() {
        if (this.player.isAttacking) return;

        this.player.isAttacking = true;

        // Stop any current animation
        this.player.stop();

        // Play attack animation
        this.player.play("player_attack");

        // Listen for animation complete event - using the standard event format
        this.player.once("animationcomplete", (animation) => {
            // Only respond to the attack animation completing
            if (animation.key === "player_attack") {
                this.player.isAttacking = false;

                // Force reset to correct animation state
                if (this.isMoving) {
                    this.player.play("player_move");
                } else {
                    // Explicitly stop any animation and set to frame 0
                    this.player.stop();
                    this.player.setFrame(0);
                }
            }
        });

        // Send attack to server
        this.socket.emit("playerAttack", {
            matchId: this.matchId,
            playerNumber: this.playerNumber,
        });

        // Check if opponent is in range for hit
        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.opponent.x,
            this.opponent.y
        );

        if (distance < 150) {
            // Apply smooth knockback to opponent locally for better responsiveness
            // This will get corrected by server updates if needed
            this.applyKnockback(this.opponent, this.player);

            // Apply visual hit feedback locally for the opponent
            this.opponent.setTint(0xff0000);
            this.time.delayedCall(200, () => {
                this.opponent.clearTint();
                this.opponent.setTint(0xff5500); // Return to orange tint
            });
        }
    }

    update() {
        if (!this.gameStarted || !this.player) return;

        const currentTime = this.time.now;
        const deltaTime = currentTime - this.lastUpdateTime;

        if (deltaTime < this.updateInterval) return;
        this.lastUpdateTime = currentTime;

        const dt = deltaTime / 1000;

        // Handle knockback physics for both characters
        this.updateKnockbackPhysics(this.player, dt);
        this.updateKnockbackPhysics(this.opponent, dt);

        // Only process movement input if not in knockback
        if (!this.player.isInKnockback) {
            let dx = 0;
            let isNowMoving = false;

            if (this.keys.a.isDown) {
                dx = -this.speed;
                isNowMoving = true;
            } else if (this.keys.d.isDown) {
                dx = this.speed;
                isNowMoving = true;
            }

            // Apply movement
            this.player.x += dx * dt;

            // Keep player on the ground
            this.player.y = this.ringTop;

            // Update animation
            if (!this.player.isAttacking) {
                if (isNowMoving && !this.isMoving) {
                    this.player.play("player_move");
                    this.isMoving = true;
                } else if (!isNowMoving && this.isMoving) {
                    this.player.stop();
                    this.player.setFrame(0);
                    this.isMoving = false;
                }
            }

            // Send position update to server
            this.socket.emit("playerMovement", {
                matchId: this.matchId,
                playerNumber: this.playerNumber,
                x: this.player.x,
                y: this.player.y,
                facing: this.player.flipX ? "right" : "left",
                isMoving: this.isMoving,
            });
        }

        // Handle attack input
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            this.attack();
        }

        // Enforce ring boundaries
        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            this.ringLeft,
            this.ringRight
        );

        // Check for ring-out
        this.checkRingOut(this.player);

        // Update facing direction
        this.updateFacingDirection();
    }

    // Enhanced knockback physics
    updateKnockbackPhysics(character, dt) {
        if (!character || !character.isInKnockback) return;

        // Apply current velocity
        character.x += character.knockbackVelocityX * dt;

        // Apply damping (slowing down effect)
        character.knockbackVelocityX *= this.knockbackDamping;

        // Keep character on the ground
        character.y = this.ringTop;

        // If velocity is very low, end knockback
        if (Math.abs(character.knockbackVelocityX) < 5) {
            character.isInKnockback = false;
            character.knockbackVelocityX = 0;
            character.knockbackVelocityY = 0;
        }

        // Enforce ring boundaries during knockback
        character.x = Phaser.Math.Clamp(
            character.x,
            this.ringLeft,
            this.ringRight
        );
    }

    // New method to check for ring-out
    checkRingOut(character) {
        if (!character) return;

        // Check if character is out of the ring
        if (character.x < this.ringLeft || character.x > this.ringRight) {
            // Notify server of ring-out
            this.socket.emit("ringOut", {
                matchId: this.matchId,
                playerNumber:
                    character === this.player
                        ? this.playerNumber
                        : this.playerNumber === 1
                        ? 2
                        : 1,
            });
        }
    }

    // Clean up when leaving scene
    shutdown() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

