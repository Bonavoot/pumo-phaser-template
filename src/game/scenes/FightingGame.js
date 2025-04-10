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

        // Knockback physics parameters
        this.knockbackForce = 300;
        this.knockbackDamping = 0.9; // Damping factor to slow down knockback
    }

    init(data) {
        // Initialize with any data passed from the menu
        this.playerName = data.playerName || "Player";
    }

    create() {
        // Setup game area
        this.cameras.main.setBackgroundColor(0x222222);

        // Add background - a sumo arena (dohyo) at full screen size

        // Get game dimensions - this approach works in all Phaser 3 versions
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        // Create the arena background and center it
        this.arenaBackground = this.add.image(
            gameWidth / 2,
            gameHeight / 2,
            "sumo-arena"
        );

        // Make the arena fill the entire game screen
        this.arenaBackground.setDisplaySize(gameWidth, gameHeight);

        // Add a resize listener to handle window/screen size changes
        this.scale.on("resize", this.resizeGame, this);

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

    // Update the resize method
    resizeGame(gameSize) {
        if (this.arenaBackground) {
            // Center the background on resize
            this.arenaBackground.setPosition(
                gameSize.width / 2,
                gameSize.height / 2
            );

            // Make it fill the entire game area
            this.arenaBackground.setDisplaySize(
                gameSize.width,
                gameSize.height
            );
        }
    }

    setupSocketListeners() {
        // Waiting for opponent
        this.socket.on("waitingForOpponent", () => {
            console.log("Waiting for opponent...");
            this.waitingText.setText("Waiting for an opponent...");
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
            if (!this.opponent) return;

            // Store previous position to detect actual movement
            const prevX = this.opponent.x;

            // Update position only if not in knockback - prevents position overrides during knockback
            if (!this.opponent.isInKnockback) {
                this.opponent.x = moveData.x;
                this.opponent.y = moveData.y;
            }

            // Determine if there was actual movement
            const hasActuallyMoved = Math.abs(prevX - moveData.x) > 0.1;

            // Update facing direction based on received data or position
            if (moveData.facing) {
                this.opponent.setFlipX(
                    moveData.facing === "left" ? false : true
                );
            } else {
                this.updateFacingDirection();
            }

            // Store the opponent's movement state
            const wasMoving = this.opponent.isMoving;
            this.opponent.isMoving = moveData.isMoving;

            // Handle animation state changes
            if (this.opponent.isAttacking) {
                // Don't change animation if attacking
                return;
            }

            // If opponent is moving (either by flag or actual position change)
            if (moveData.isMoving || hasActuallyMoved) {
                // Only start the animation if it's not already playing
                if (!wasMoving || !this.opponent.anims.isPlaying) {
                    this.opponent.play("player_move", true);
                }
            } else {
                // Stop movement animation and show idle frame
                this.opponent.stop();
                this.opponent.setFrame(0);
            }
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

    // New method to apply a smooth physics-based knockback
    applyKnockback(target, source) {
        // Mark the target as being in knockback
        target.isInKnockback = true;

        // Calculate direction from source to target
        const angle = Phaser.Math.Angle.Between(
            source.x,
            source.y,
            target.x,
            target.y
        );

        // Initialize or reset velocity properties on the target
        target.knockbackVelocityX = Math.cos(angle) * this.knockbackForce * 6.5;
        target.knockbackVelocityY = Math.sin(angle) * this.knockbackForce * 0.1; // Less vertical force

        // If both objects are at the same position, knock back to the left or right
        if (Math.abs(target.x - source.x) < 10) {
            target.knockbackVelocityX =
                (target.flipX ? -1 : 1) * this.knockbackForce;
        }

        // Add a small upward force for a slight hop effect
        target.knockbackVelocityY = 0;

        // Tell the server about this knockback
        if (target === this.player) {
            this.socket.emit("playerKnockback", {
                matchId: this.matchId,
                playerNumber: this.playerNumber,
                velocityX: target.knockbackVelocityX,
                velocityY: target.knockbackVelocityY,
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
                frameRate: 30, // Increased for faster animation
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
        this.player = this.add.sprite(playerState.x, playerState.y, "player");
        this.player.setFrame(0); // Set initial frame
        this.player.setScale(0.75);
        this.player.isMoving = false;
        this.player.isAttacking = false;
        this.player.isInKnockback = false;
        this.player.knockbackVelocityX = 0;
        this.player.knockbackVelocityY = 0;

        // Create the opponent
        this.opponent = this.add.sprite(
            opponentState.x,
            opponentState.y,
            "player"
        );
        this.opponent.setFrame(0);
        this.opponent.isMoving = false;
        this.opponent.isAttacking = false;
        this.opponent.isInKnockback = false;
        this.opponent.knockbackVelocityX = 0;
        this.opponent.knockbackVelocityY = 0;
        this.opponent.setScale(0.75);

        // Set player tint to distinguish from opponent

        this.opponent.setTint(0xff5500); // Orange tint

        // Initial facing direction
        this.updateFacingDirection();
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

        const dt = this.sys.game.loop.delta / 1000; // Convert to seconds

        // Handle knockback physics for player
        this.updateKnockbackPhysics(this.player, dt);

        // Handle knockback physics for opponent (for smoother local simulation)
        this.updateKnockbackPhysics(this.opponent, dt);

        // Only process movement input if not in knockback
        if (!this.player.isInKnockback) {
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

            // Apply movement
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

        // Send position update to server (only if not in knockback for consistency)
        if (!this.player.isInKnockback) {
            this.socket.emit("playerMovement", {
                matchId: this.matchId,
                playerNumber: this.playerNumber,
                x: this.player.x,
                y: this.player.y,
                facing: this.player.flipX ? "right" : "left", // Add facing information
                isMoving: this.isMoving,
            });
        }
    }

    // Method to handle knockback physics
    updateKnockbackPhysics(character, dt) {
        if (!character || !character.isInKnockback) return;

        // Apply current velocity
        character.x += character.knockbackVelocityX * dt;
        character.y += character.knockbackVelocityY * dt;

        // Apply gravity to vertical movement
        character.knockbackVelocityY += 500 * dt; // Gravity effect

        // Apply damping (slowing down effect)
        character.knockbackVelocityX *= this.knockbackDamping;

        // If velocity is very low, end knockback
        if (Math.abs(character.knockbackVelocityX) < 10) {
            character.isInKnockback = false;
            character.knockbackVelocityX = 0;
            character.knockbackVelocityY = 0;

            // Ensure character is at floor level
            character.y = 450; // Reset to floor position

            // If this was the player, notify server knockback has ended
            if (character === this.player) {
                this.socket.emit("playerMovement", {
                    matchId: this.matchId,
                    playerNumber: this.playerNumber,
                    x: this.player.x,
                    y: this.player.y,
                    facing: this.player.flipX ? "right" : "left",
                    isMoving: this.isMoving,
                });
            }
        }

        // Enforce boundaries during knockback
        character.x = Phaser.Math.Clamp(character.x, 50, 974);

        // If character hits floor, bounce slightly
        if (character.y > 450) {
            character.y = 450;
            character.knockbackVelocityY *= -0.3; // Bounce with reduced velocity
        }
    }

    // Clean up when leaving scene
    shutdown() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

