// import * as MainLoop from "mainloop.js";
// import MainLoop = require("mainloop.js");

// import * as MainLoop from "./node_modules/mainloop.js/build/mainloop.min.js";

import {GPU, IKernelFunctionThis, IKernelRunShortcutBase, input, Input} from "gpu.js";
// @ts-ignore Rider's TS compiler works weird compared to Parcel's
import MainLoop = require("mainloop.js");

document.addEventListener("DOMContentLoaded", onDOMLoaded);

const gpu = new GPU({ mode: "gpu" }); // for now CPU is like 2 times faster than GPU, because copying data to and from GPU is slow at this scale :(. 
// TODO: implement second graphical kernel that draws straight to canvas and check performance

// returns x or y position of given particle, depending on given thread.x and thread.y
// [fakeY, fakeX] for fake transformation of particles to 2D array. thread.z should be (XorY result)
function velocityKernelFunction(this : IKernelFunctionThis, particlesPositionsX : Float32Array[], particlesPositionsY : Float32Array[], // these should probably be Float32Array[]
                                particlesVelocitiesX : Float32Array[],particlesVelocitiesY : Float32Array[], particlesAlive : Float32Array[]) : number // 2.4ms on GPU
{
    if (particlesAlive[this.thread.y][this.thread.x] == 0) // 0 is dead, 1 is alive
        return 0;
    
    const coordinate = this.thread.z;
    const particlePositionX = particlesPositionsX[this.thread.y][this.thread.x];
    const particlePositionY = particlesPositionsY[this.thread.y][this.thread.x];
    
    if (coordinate == 0) // 0 means we want X, 1 means we want Y
        return particlePositionX + particlesVelocitiesX[this.thread.y][this.thread.x];
    
    return particlePositionY + particlesVelocitiesY[this.thread.y][this.thread.x];
}

globalThis.velocityKernel = gpu.createKernel<typeof velocityKernelFunction>(velocityKernelFunction).setImmutable(true).setOutput([240, 320, 2]);


function onDOMLoaded(){
    globalThis.canvas = <HTMLCanvasElement>document.getElementById("canvas"); // careful, this means canvas won't ever get GC'ed
    globalThis.fpsCounter = <HTMLElement>document.getElementById("fps");
    globalThis.particlesColumns = 320 as number;
    globalThis.particlesRows = 200 as number;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    // (<IKernelRunShortcutBase>globalThis.velocityKernel).setOutput([globalThis.particlesColumns, globalThis.particlesRows, 2]);
    globalThis.particleDisplaySize = 3 as number;
    globalThis.canvas.width = globalThis.particlesColumns * globalThis.particleDisplaySize;
    globalThis.canvas.height = globalThis.particlesRows * globalThis.particleDisplaySize;
    globalThis.ctx = globalThis.canvas.getContext("2d") as CanvasRenderingContext2D;
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";

    globalThis.particlesPositionsX = new Float32Array(globalThis.initialParticlesCount); // change those to Float32Array
    globalThis.particlesPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesAlive = new Float32Array(globalThis.initialParticlesCount); // 0 is dead, 1 is alive (gpu.js doesn't take boolean[] as input)
    
    const planetCenterX : number = 50;
    const planetCenterY : number = 100;
    const planetRadius : number = 40;

    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        let x = Math.floor(i % globalThis.particlesColumns); // why floor?
        let y = Math.floor(i / globalThis.particlesColumns);
        globalThis.particlesPositionsX[i] = x;
        globalThis.particlesPositionsY[i] = y;
        
        // USE MAINLOOP.JS
        if (isPointInCircle(x, y, planetCenterX, planetCenterY, planetRadius)) {
            globalThis.particlesAlive[i] = true;
            globalThis.particlesVelocitiesX[i] = 1.0;
        }
        
    }
    
    // Problem, intentionally MainLoop is often called twice in a frame, that's not really acceptable, copying to gpu, from gpu, to gpu and from gpu
    // Don't pass anything to setMaxAllowedFPS to prevent that. 
    // Set SimulationTimestep to 1000/60 to update and draw 60 times per second, or to 1000/30 to draw 60 times per second and update 30 times 
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).setMaxAllowedFPS().setSimulationTimestep(1000.0/60).start();
}

function update(delta : Number) : void{
    // console.log("update");
    // note that arrays here are transformed to 2D but this has no relation to the actual positions of particles
    // it's just required to fit into kernel's textures
    const result = (<IKernelRunShortcutBase>globalThis.velocityKernel)(new Input(globalThis.particlesPositionsX, [globalThis.particlesColumns, globalThis.particlesRows]),
        new Input(globalThis.particlesPositionsY, [globalThis.particlesColumns, globalThis.particlesRows]),
        new Input(globalThis.particlesVelocitiesX, [globalThis.particlesColumns, globalThis.particlesRows]),
        new Input(globalThis.particlesVelocitiesY, [globalThis.particlesColumns, globalThis.particlesRows]),
        new Input(globalThis.particlesAlive, [globalThis.particlesColumns, globalThis.particlesRows])) as any;

    // console.log(result);
    
    for (let z = 0; z < result.length; z++) { // are these loops correct?
        for (let y = 0; y < result[0].length; y++) {
            for (let x = 0; x < result[0][0].length; x++) {
                if (z == 0)
                    globalThis.particlesPositionsX[y * globalThis.particlesColumns + x] = result[z][y][x];
                else if (z == 1)
                    globalThis.particlesPositionsY[y * globalThis.particlesColumns + x] = result[z][y][x];
            }
            
        }
    }
    
    // result.delete();
    
    // console.log(result as [number, number, number]);
}

function draw(interpolationPercentage : number){ // takes ~3 ms
    // for (let y = 0; y < globalThis.particlesRows; y++) {
    //     for (let x = 0; x < globalThis.particlesColumns; x++) {
    //        
    //     }
    // }
    globalThis.ctx.clearRect(0, 0, globalThis.canvas.width, globalThis.canvas.height);
    
    for (let i = 0; i < globalThis.particlesPositionsX.length; i++) {
        if (!globalThis.particlesAlive[i])
            continue;
        
        globalThis.ctx.fillRect(Math.round(globalThis.particlesPositionsX[i]) * globalThis.particleDisplaySize, Math.round(globalThis.particlesPositionsY[i]) * globalThis.particleDisplaySize, 
            globalThis.particleDisplaySize, globalThis.particleDisplaySize);
    }
}

function end(fps : number, panic : boolean) {
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

function isPointInCircle(x : number, y : number, centerX : number, centerY : number, radius : number) : boolean {
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5); // 0.25 or 0.5 or 0.7071?
}

async function sleep(msec) {
    // @ts-ignore
    return new Promise(resolve => setTimeout(resolve, msec));
}
