import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, "background");

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on("progress", (progress) => {
            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game
        this.load.setPath("assets");

        this.load.image("logo", "logo.png");
        this.load.image("star", "star.png");
        this.load.image("sumo-arena", "sumo-arena.png");

        // Load the attack image
        this.load.spritesheet("slap1", "slap1.png", {
            frameWidth: 384,
            frameHeight: 384,
        });

        // Load the player spritesheet
        this.load.spritesheet("player", "waddle-spritesheet.png", {
            frameWidth: 384,
            frameHeight: 384,
        });
    }

    create() {
        this.scene.start("MainMenu");
    }
}

