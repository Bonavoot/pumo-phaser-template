import { Boot } from "./scenes/Boot";
import { Game } from "./scenes/Game";
import { GameOver } from "./scenes/GameOver";
import { MainMenu } from "./scenes/MainMenu";
import Phaser from "phaser";
import { Preloader } from "./scenes/Preloader";
import { FightingGame } from "./scenes/FightingGame"; // Import the fighting game scene

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: "game-container",
    backgroundColor: "#222222",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 300 },
            debug: false,
        },
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        Game,
        FightingGame, // Add our fighting game scene
        GameOver,
    ],
};

const StartGame = (parent) => {
    return new Phaser.Game({ ...config, parent });
};

export default StartGame;
