import { useRef } from "react";
import { PhaserGame } from "./game/PhaserGame";

function App() {
    const phaserRef = useRef();

    return (
        <div
            id="app"
            style={{ width: "100%", height: "100vh", overflow: "hidden" }}
        >
            <PhaserGame ref={phaserRef} />
        </div>
    );
}

export default App;

