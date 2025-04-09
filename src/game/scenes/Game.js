import { EventBus } from "../EventBus";
import { Scene } from "phaser";

export class Game extends Scene {
    constructor() {
        super("Game");
        this.player = null;
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

        this.cameras.main.setBackgroundColor(0x00ff00);

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
                this.worldBounds.height * 0.2, // Position text at 20% from the top
                "Use WASD Keys to Move the Character\nPress F for Fullscreen",
                {
                    fontFamily: "Arial Black",
                    fontSize: Math.min(24, this.worldBounds.width / 30), // Responsive text size
                    color: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 4,
                    align: "center",
                }
            )
            .setOrigin(0.5)
            .setDepth(100);

        // Create player sprite in the middle of the screen
        this.player = this.add.sprite(
            this.worldBounds.width / 2,
            this.worldBounds.height / 2,
            "player"
        );

        // Create animations if they don't already exist
        if (!this.anims.exists("player_move")) {
            this.anims.create({
                key: "player_move",
                frames: this.anims.generateFrameNumbers("player", {
                    start: 0,
                    end: 13, // Adjust based on your spritesheet frame count
                }),
                frameRate: 30,
                repeat: -1,
            });
        }

        // Create idle animation (optional - if your spritesheet has an idle frame)
        if (!this.anims.exists("player_idle")) {
            this.anims.create({
                key: "player_idle",
                frames: [{ key: "player", frame: 0 }], // Use the first frame for idle
                frameRate: 10,
                repeat: 0,
            });
        }

        // Optional: Adjust player scale based on screen size
        const scaleFactor = Math.min(
            this.worldBounds.width / 1024,
            this.worldBounds.height / 768
        );
        this.player.setScale(scaleFactor);

        // Display idle frame initially
        this.player.setFrame(0);

        // Setup WASD keyboard controls
        this.keys = {
            w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        // Listen for resize events
        this.scale.on("resize", this.resize, this);

        EventBus.emit("current-scene-ready", this);
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
        this.player.setScale(1);

        // Reset movement
        let dx = 0;
        let dy = 0;

        // Handle horizontal movement (A and D keys)
        if (this.keys.a.isDown) {
            dx = -this.speed * 1.5;
            // this.player.setFlipX(false);
        } else if (this.keys.d.isDown) {
            dx = this.speed * 1.5;
            // this.player.setFlipX(true);
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

        // Keep the player within bounds - adjust padding based on player scale
        const padding = 20 * this.player.scaleX;
        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            padding,
            this.worldBounds.width - padding
        );
        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            padding,
            this.worldBounds.height - padding
        );
    }

    changeScene() {
        this.scene.start("GameOver");
    }
}

