import { EventBus } from "../EventBus";
import { Scene } from "phaser";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        // Background
        this.add.image(512, 384, "background");

        // Title text
        this.add
            .text(512, 200, "PUMO PUMO", {
                fontFamily: "Arial Black",
                fontSize: 48,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 8,
                align: "center",
            })
            .setDepth(100)
            .setOrigin(0.5);

        // // Subtitle text
        // this.add
        //     .text(512, 270, "1v1 Multiplayer", {
        //         fontFamily: "Arial Black",
        //         fontSize: 28,
        //         color: "#ffcc00",
        //         stroke: "#000000",
        //         strokeThickness: 5,
        //         align: "center",
        //     })
        //     .setDepth(100)
        //     .setOrigin(0.5);

        // Play Button
        const playButton = this.add
            .text(512, 380, "PLAY ONLINE", {
                fontFamily: "Arial Black",
                fontSize: 36,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 6,
                align: "center",
            })
            .setDepth(100)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () => {
                playButton.setTint(0x88ff88);
                playButton.setScale(1.1);
            })
            .on("pointerout", () => {
                playButton.clearTint();
                playButton.setScale(1.0);
            })
            .on("pointerdown", () => {
                // Start matchmaking in the FightingGame scene
                this.scene.start("FightingGame", { playerName: "Player" });
            });

        // Practice Button (for future implementation)
        const practiceButton = this.add
            .text(512, 460, "PRACTICE MODE", {
                fontFamily: "Arial Black",
                fontSize: 28,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 5,
                align: "center",
            })
            .setDepth(100)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () => {
                practiceButton.setTint(0x88ff88);
                practiceButton.setScale(1.05);
            })
            .on("pointerout", () => {
                practiceButton.clearTint();
                practiceButton.setScale(1.0);
            })
            .on("pointerdown", () => {
                // For now, just start the single player game
                this.scene.start("Game");
            });

        // Credits text
        this.add
            .text(512, 700, "Version 0.1 - Early Development", {
                fontFamily: "Arial",
                fontSize: 16,
                color: "#aaaaaa",
                align: "center",
            })
            .setDepth(100)
            .setOrigin(0.5);

        EventBus.emit("current-scene-ready", this);
    }
}

