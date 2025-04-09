import { EventBus } from "../EventBus";
import { Scene } from "phaser";

export class Game extends Scene {
    constructor() {
        super("Game");
        this.player = null;
        this.opponent = null; // Adding an AI opponent for practice
        this.keys = null;
        this.speed = 200;
        this.worldBounds = {
            width: 1024,
            height: 768,
        };
        this.isMoving = false; // Track if player is moving
    }

    create() {
        // Setup world bounds based on the actual canvas size
        this.worldBounds.width = this.scale.width;
        this.worldBounds.height = this.scale.height;

        this.cameras.main.setBackgroundColor(0x222222);

        // Use the full width and height of the canvas for background
        this.add
            .image(
                this.worldBounds.width / 2,
                this.worldBounds.height / 2,
                "background"
            )
            .setDisplaySize(this.worldBounds.width, this.worldBounds.height)
            .setAlpha(0.5);

        // Add instructions text
        this.add
            .text(
                this.worldBounds.width / 2,
                this.worldBounds.height * 0.1,
                "Practice Mode\nUse A and D Keys to Move Left and Right",
                {
                    fontFamily: "Arial Black",
                    fontSize: Math.min(24, this.worldBounds.width / 30),
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4,
                    align: "center",
                }
            )
            .setOrigin(0.5)
            .setDepth(100);

        // Add floor/platform
        const floor = this.add
            .rectangle(this.worldBounds.width / 2, 550, 800, 30, 0x555555)
            .setStrokeStyle(2, 0x888888);

        // Create player sprite on the left side
        this.player = this.add.sprite(
            this.worldBounds.width / 4,
            450,
            "player"
        );
        this.player.setScale(0.75);
        this.player.setTint(0x0088ff); // Blue tint

        // Create an AI opponent on the right side
        this.opponent = this.add.sprite(
            (this.worldBounds.width / 4) * 3,
            450,
            "player"
        );
        this.opponent.setScale(0.75);
        this.opponent.setTint(0xff5500); // Orange tint

        // Set initial facing
        this.updateFacingDirection();

        // Create animations if they don't already exist
        if (!this.anims.exists("player_move")) {
            this.anims.create({
                key: "player_move",
                frames: this.anims.generateFrameNumbers("player", {
                    start: 0,
                    end: 13,
                }),
                frameRate: 30,
                repeat: -1,
            });
        }

        // Setup WASD keyboard controls
        this.keys = {
            a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        // Listen for resize events
        this.scale.on("resize", this.resize, this);

        EventBus.emit("current-scene-ready", this);
    }

    // New method to update facing direction based on relative positions
    updateFacingDirection() {
        if (!this.player || !this.opponent) return;

        // Determine facing based on relative positions
        // If player is to the left of opponent, player faces right and opponent faces left
        if (this.player.x < this.opponent.x) {
            this.player.setFlipX(true); // Player looks right
            this.opponent.setFlipX(false); // Opponent looks left
        } else {
            this.player.setFlipX(false); // Player looks left
            this.opponent.setFlipX(true); // Opponent looks right
        }
    }

    resize(gameSize) {
        // Update world bounds
        this.worldBounds.width = gameSize.width;
        this.worldBounds.height = gameSize.height;

        // Rescale and center the background
        const bg = this.children.getByName("background");
        if (bg) {
            bg.setPosition(gameSize.width / 2, gameSize.height / 2);
            bg.setDisplaySize(gameSize.width, gameSize.height);
        }
    }

    update() {
        // Handle player movement
        if (!this.player || !this.keys) return;

        // Reset movement
        let dx = 0;

        // Handle horizontal movement (A and D keys)
        if (this.keys.a.isDown) {
            dx = -this.speed * 1.5;
        } else if (this.keys.d.isDown) {
            dx = this.speed * 1.5;
        }

        // Check if player is moving
        const isNowMoving = dx !== 0;

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

        // Keep the player within bounds
        const padding = 50;
        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            padding,
            this.worldBounds.width - padding
        );

        // Move opponent a little bit randomly to simulate AI behavior
        if (Math.random() < 0.01) {
            // 1% chance per frame to change direction
            this.opponent.moveDirection = Math.random() < 0.5 ? -1 : 1;

            // Sometimes stay still
            if (Math.random() < 0.3) this.opponent.moveDirection = 0;

            // Start/stop animations
            if (this.opponent.moveDirection !== 0) {
                this.opponent.play("player_move");
            } else {
                this.opponent.stop();
                this.opponent.setFrame(0);
            }
        }

        if (this.opponent.moveDirection) {
            this.opponent.x +=
                this.opponent.moveDirection * this.speed * 0.5 * dt;

            // Keep opponent within bounds
            this.opponent.x = Phaser.Math.Clamp(
                this.opponent.x,
                padding,
                this.worldBounds.width - padding
            );
        }

        // Update facing direction based on relative positions
        this.updateFacingDirection();
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}

