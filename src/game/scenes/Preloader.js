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
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath("assets");

        this.load.image("logo", "logo.png");
        this.load.image("star", "star.png");

        // Load the spritesheet you created
        // Adjust the frameWidth and frameHeight to match your spritesheet dimensions
        this.load.spritesheet("player", "waddle-spritesheet.png", {
            frameWidth: 384, // IMPORTANT: Change this to match your frame width
            frameHeight: 384, // IMPORTANT: Change this to match your frame height
            // If your frames aren't perfectly aligned in a grid, you can use:
            // spacing: 1,     // Pixel spacing between frames horizontally
            // margin: 1       // Pixel spacing around the edge of the sheet
        });
    }

    create() {
        // Animation definitions can be defined here or in the Game scene
        // Define the movement animation
        this.anims.create({
            key: "player_move",
            frames: this.anims.generateFrameNumbers("player", {
                start: 0,
                end: 13, // IMPORTANT: Set this to (total frames - 1)
            }),
            frameRate: 30, // Adjust for your preferred animation speed
            repeat: -1, // -1 means loop forever
        });

        // Define an idle animation (using just the first frame)
        this.anims.create({
            key: "player_idle",
            frames: [{ key: "player", frame: 0 }],
            frameRate: 10,
            repeat: 0,
        });

        this.scene.start("MainMenu");
    }
}

