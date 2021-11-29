// import * as MainLoop from "mainloop.js";
// import MainLoop = require("mainloop.js");
// import * as MainLoop from "./node_modules/mainloop.js/build/mainloop.min.js";
import { GPU } from "gpu.js";
document.addEventListener("DOMContentLoaded", onDOMLoaded);
const gpu = new GPU();
gpu.createKernel(() => { });
function onDOMLoaded() {
    let canvas = document.getElementById("canvas");
    globalThis.fpsCounter = document.getElementById("fps");
    globalThis.particlesColumns = 320;
    globalThis.particlesRows = 200;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    globalThis.particleDisplaySize = 3;
    canvas.width = globalThis.particlesColumns * globalThis.particleDisplaySize;
    canvas.height = globalThis.particlesRows * globalThis.particleDisplaySize;
    globalThis.ctx = canvas.getContext("2d");
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";
    globalThis.particlesPositionsX = Array(globalThis.initialParticlesCount).fill(0.0);
    globalThis.particlesPositionsY = Array(globalThis.initialParticlesCount).fill(0.0);
    globalThis.particlesVelocitiesX = Array(globalThis.initialParticlesCount).fill(0.0);
    globalThis.particlesVelocitiesY = Array(globalThis.initialParticlesCount).fill(0.0);
    globalThis.particlesAlive = Array(globalThis.initialParticlesCount).fill(false);
    const planetCenterX = 200;
    const planetCenterY = 100;
    const planetRadius = 40;
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        let x = Math.floor(i % globalThis.particlesColumns); // why floor?
        let y = Math.floor(i / globalThis.particlesColumns);
        globalThis.particlesPositionsX[i] = x;
        globalThis.particlesPositionsY[i] = y;
        // USE MAINLOOP.JS
        if (isPointInCircle(x, y, planetCenterX, planetCenterY, planetRadius)) {
            globalThis.particlesAlive[i] = true;
        }
    }
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).start();
}
function update(delta) {
    // console.log("update");
}
function draw(interpolationPercentage) {
    // for (let y = 0; y < globalThis.particlesRows; y++) {
    //     for (let x = 0; x < globalThis.particlesColumns; x++) {
    //        
    //     }
    // }
    for (let i = 0; i < globalThis.particlesPositionsX.length; i++) {
        if (!globalThis.particlesAlive[i])
            continue;
        globalThis.ctx.fillRect(Math.round(globalThis.particlesPositionsX[i]) * globalThis.particleDisplaySize, Math.round(globalThis.particlesPositionsY[i]) * globalThis.particleDisplaySize, globalThis.particleDisplaySize, globalThis.particleDisplaySize);
    }
}
function end(fps, panic) {
    globalThis.fpsCounter.textContent = Math.round(fps) + ' FPS';
    if (panic) {
        // This pattern introduces non-deterministic behavior, but in this case
        // it's better than the alternative (the application would look like it
        // was running very quickly until the simulation caught up to real
        // time). See the documentation for `MainLoop.setEnd()` for additional
        // explanation.
        let discardedTime = Math.round(MainLoop.resetFrameDelta());
        console.warn('Main loop panicked, probably because the browser tab was put in the background. Discarding ' + discardedTime + 'ms');
    }
}
function isPointInCircle(x, y, centerX, centerY, radius) {
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5); // 0.25 or 0.5 or 0.7071?
}
//# sourceMappingURL=asteroids.js.map