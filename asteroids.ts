// @ts-ignore Rider's TS compiler works weird compared to Parcel's
import MainLoop = require("mainloop.js");

window.addEventListener("load", onLoaded);


function onLoaded() {
    // TODO: add class/interface to globalThis, that holds all these
    globalThis.canvas = <HTMLCanvasElement>document.getElementById("canvas"); // careful, this means canvas won't ever get GC'ed
    globalThis.fpsCounter = <HTMLElement>document.getElementById("fps");
    globalThis.particlesColumns = 320 as number;
    globalThis.particlesRows = 200 as number;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    globalThis.canvas.width = globalThis.particlesColumns;
    globalThis.canvas.height = globalThis.particlesRows;
    globalThis.ctx = (<HTMLCanvasElement>globalThis.canvas).getContext("2d", {alpha: false});
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";
    let isMobile = window.matchMedia("only screen and (max-width: 480px)").matches;
    screen.orientation.addEventListener('change', function(e) { 
        if (window.matchMedia("only screen and (max-height: 4200px)").matches && (screen.orientation.type === "landscape-primary" || screen.orientation.type === "landscape-secondary"))
            document.documentElement.requestFullscreen();});

    globalThis.particlesPositionsX = new Float32Array(globalThis.initialParticlesCount); // TODO: those are pools of particles
    globalThis.particlesPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesPrevTickPositionsX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesPrevTickPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesPrevPrevTickPositionsX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesPrevPrevTickPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesAlive = new Array<boolean>(globalThis.initialParticlesCount).fill(false);
    globalThis.rotationGroupAssignments = new Uint8Array(globalThis.initialParticlesCount).fill(0);

    // max 4 particles per collision cell
    globalThis.particleCollisionLookup = new Array<Int32Array>(globalThis.particlesColumns * globalThis.particlesRows).fill(null).map(i => new Int32Array(4));
    globalThis.particleCollisionLookup.forEach(cell => cell.fill(-1));
    globalThis.collisionLookupCountAtCell = new Uint8Array(globalThis.initialParticlesCount);

    const planetCenterX: number = 200;
    const planetCenterY: number = 100;
    const planetRadius: number = 40;

    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        let x = Math.floor(i % globalThis.particlesColumns); // why floor?
        let y = Math.floor(i / globalThis.particlesColumns);

        if (isPointInCircle(x, y, planetCenterX, planetCenterY, planetRadius) ||
            (x > planetCenterX - 2 && x < planetCenterX + 2 && y > planetCenterY - planetRadius - 6 && y < planetCenterY)) {
            globalThis.particlesAlive[i] = true;
            // globalThis.particlesVelocitiesX[i] = 1.0;
            globalThis.particlesPositionsX[i] = x;
            globalThis.particlesPositionsY[i] = y;
            globalThis.rotationGroupAssignments[i] = 1;
        }

    }

    // await sleep(1000);
    globalThis.tick = 1;

    // Problem, intentionally MainLoop is often called twice in a frame
    // Don't pass anything to setMaxAllowedFPS to prevent that. 
    // Set SimulationTimestep to 1000/60 to update and draw 60 times per second, or to 1000/30 to draw 60 times per second and update 30 times 
    // seems like update is still called multiple times per frame, possibly also spiral of death
    // can't rely on requestAnimationFrame frame rate, any device can limit it to anything like 50, 30 
    // which means update has to be called multiple times per frame
    const kindaTargetFPs = 30;
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).setMaxAllowedFPS(kindaTargetFPs).setSimulationTimestep(1000.0 / kindaTargetFPs).start();
}

function update(delta: Number): void {
    // rotation to velocity
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i])
            continue;
        
        if (globalThis.rotationGroupAssignments[i] === 0)
            continue;
        
        let x = globalThis.particlesPositionsX[i];
        let y = globalThis.particlesPositionsY[i];

        if (globalThis.rotationGroupAssignments[i] === 1){
            let pivotX = 200; // TODO: un-hardcode it
            let pivotY = 100;
            var angle = Math.atan2(y, x);
            angle = 0.05;
            let xr = (x - pivotX) * Math.cos(angle) - (y - pivotY) * Math.sin(angle)   + pivotX;
            let yr = (x - pivotX) * Math.sin(angle) + (y - pivotY) * Math.cos(angle)   + pivotY;
            globalThis.particlesVelocitiesX[i] = xr - x;
            globalThis.particlesVelocitiesY[i] = yr - y;
        }
    }
    
    // apply velocity and fill particle collision lookup
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i]) {
            continue;
        }
        let newX = globalThis.particlesPositionsX[i] + globalThis.particlesVelocitiesX[i];
        let newY = globalThis.particlesPositionsY[i] + globalThis.particlesVelocitiesY[i];
        globalThis.particlesNewPositionsX[i] = newX;
        globalThis.particlesNewPositionsY[i] = newY;

        // TODO: change it to check if it was inside grid on previous tick and now isn't, then kill it
        if (newX < 0 || newX >= globalThis.particlesColumns || newY < 0 || newY >= globalThis.particlesRows) { 
            globalThis.particlesAlive[i] = false;
            continue;
        }

        let indexOfCollisionLookup = Math.round(newY) * globalThis.particlesColumns + Math.round(newX);
        if (globalThis.collisionLookupCountAtCell[indexOfCollisionLookup] >= 4) {
            continue; // collision cell is full
        }

        globalThis.particleCollisionLookup[indexOfCollisionLookup][globalThis.collisionLookupCountAtCell[indexOfCollisionLookup]] = i;
        globalThis.collisionLookupCountAtCell[indexOfCollisionLookup]++;
    }

    // handle collisions
    for (let i = 0; i < globalThis.particleCollisionLookup.length; i++) {
        if (globalThis.collisionLookupCountAtCell[i] <= 1)
            continue;

        let particlesToCheck = globalThis.particleCollisionLookup[i];
        let firstParticlesRotationGroup = globalThis.rotationGroupAssignments[particlesToCheck[0]];
        let allParticlesSameRotationGroup = true;

        for (let j = 1; j < globalThis.collisionLookupCountAtCell[i]; j++) {
            if (globalThis.rotationGroupAssignments[particlesToCheck[j]] !== firstParticlesRotationGroup) {
                allParticlesSameRotationGroup = false;
                break;
            }
        }
        
        if (allParticlesSameRotationGroup)
            continue;

        for (let j = 0; j < globalThis.collisionLookupCountAtCell[i]; j++) {
            globalThis.particlesAlive[particlesToCheck[j]] = false;
            // how to prevent a rotating planet from destroying itself over time?
            // console.log("Killing particle " + particlesToCheck[j]);
        }
    }

    // clean up collision lookup
    for (let i = 0; i < globalThis.particleCollisionLookup.length; i++) {
        for (let j = 0; j < globalThis.particleCollisionLookup[i].length; j++) {
            globalThis.particleCollisionLookup[i][j] = -1; // is that right?
        }
        globalThis.collisionLookupCountAtCell[i] = 0;
    }


    if (globalThis.tick == 1) {
        spawnAsteroid(42, 12, 11, 1, 0.4);
        spawnAsteroid(42, 80, 16, 1, 0.1);
        spawnAsteroid(42, 170, 20, 1, -0.2);
    }

    // apply new positions to positions arrays, and clear newPositions arrays; also store prevTickPositions
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        globalThis.particlesPrevPrevTickPositionsX[i] = globalThis.particlesPrevTickPositionsX[i].valueOf();
        globalThis.particlesPrevPrevTickPositionsY[i] = globalThis.particlesPrevTickPositionsY[i].valueOf();
        globalThis.particlesPrevTickPositionsX[i] = globalThis.particlesPositionsX[i].valueOf();
        globalThis.particlesPrevTickPositionsY[i] = globalThis.particlesPositionsY[i].valueOf();
        globalThis.particlesPositionsX[i] = globalThis.particlesNewPositionsX[i].valueOf();
        globalThis.particlesPositionsY[i] = globalThis.particlesNewPositionsY[i].valueOf();
        globalThis.particlesNewPositionsX[i] = 0;
        globalThis.particlesNewPositionsY[i] = 0;
    }

    globalThis.tick++;
}

function draw(interpolationPercentage: number) { // with fillRect takes ~3 ms, with setImageData takes ~0.5 ms on my PC :)
    // console.log("alive: " +globalThis.particlesAlive.filter(x => x == true).length);
    const width = globalThis.canvas.width;
    const height = globalThis.canvas.height;
    let imageData = globalThis.ctx.createImageData(width, height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] = 255;  // R value
        imageData.data[i + 1] = 255;    // G value
        imageData.data[i + 2] = 255;  // B value
        imageData.data[i + 3] = 255;  // A value
    }

    // draw previous-previous tick's positions grey
    for (let i = 0; i < globalThis.initialParticlesCount; i++){
        if (!globalThis.particlesAlive[i])
            continue;

        let x = Math.round(globalThis.particlesPrevPrevTickPositionsX[i]);
        let y = Math.round(globalThis.particlesPrevPrevTickPositionsY[i]);

        if (x < 0 || x >= width || y < 0 || y >= height)
            continue;
        // console.log("x: " + x);
        // console.log("y: " + y);
        let offset = (y * width + x) * 4; // because rgba, maybe 3 because I disabled alpha?

        imageData.data[offset] = 30;
        imageData.data[offset + 1] = 30;
        imageData.data[offset + 2] = 30;
    }
    
    // draw previous tick's positions grey
    for (let i = 0; i < globalThis.initialParticlesCount; i++){
        if (!globalThis.particlesAlive[i])
            continue;

        let x = Math.round(globalThis.particlesPrevTickPositionsX[i]);
        let y = Math.round(globalThis.particlesPrevTickPositionsY[i]);

        if (x < 0 || x >= width || y < 0 || y >= height)
            continue;
        // console.log("x: " + x);
        // console.log("y: " + y);
        let offset = (y * width + x) * 4; // because rgba, maybe 3 because I disabled alpha?

        imageData.data[offset] = 20;
        imageData.data[offset + 1] = 20;
        imageData.data[offset + 2] = 20;
    }

    // draw current tick's positions black
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i])
            continue;

        let x = Math.round(globalThis.particlesPositionsX[i]);
        let y = Math.round(globalThis.particlesPositionsY[i]);

        if (x < 0 || x >= width || y < 0 || y >= height)
            continue;
        // console.log("x: " + x);
        // console.log("y: " + y);
        let offset = (y * width + x) * 4; // because rgba, maybe 3 because I disabled alpha?

        imageData.data[offset] = 0;
        imageData.data[offset + 1] = 0;
        imageData.data[offset + 2] = 0;
        // imageData.data[offset + 3] = 255;
    }

    globalThis.ctx.putImageData(imageData, 0, 0);
}

function end(fps: number, panic: boolean) {
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

function isPointInCircle(x: number, y: number, centerX: number, centerY: number, radius: number): boolean {
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5); // 0.25 or 0.5 or 0.7071?
}

function spawnAsteroid(centerX: number, centerY: number, r: number, vx: number, vy: number): void {
    // TODO: how to make it work if positions are pools, find dead particles and use them, but I'd need to place them manually
    const minX: number = centerX - r; // maybe also -0.5
    const maxX: number = centerX + r + 1; // maybe also +0.5
    const minY: number = centerY - r; // maybe also -0.5
    const maxY: number = centerY + r + 1; // maybe also +0.5
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    let indexInRegionToCheck: number = 0;

    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (globalThis.particlesAlive[i])
            continue; // this particle is already used for something

        let foundPixelForThisParticle: boolean = false;
        while (!foundPixelForThisParticle && indexInRegionToCheck < regionWidth * regionHeight) {
            let x = Math.floor(indexInRegionToCheck % regionWidth) + minX; // why floor? // regionHeight or regionWidth?
            let y = Math.floor(indexInRegionToCheck / regionWidth) + minY;
            if (isPointInCircle(x, y, centerX, centerY, r)) {
                globalThis.particlesAlive[i] = true;
                globalThis.particlesVelocitiesX[i] = vx;
                globalThis.particlesVelocitiesY[i] = vy;
                globalThis.particlesNewPositionsX[i] = x;
                globalThis.particlesNewPositionsY[i] = y;
                foundPixelForThisParticle = true
                if (i == 0)
                    console.log("index " + i + " at " + x + "; " + y);
            }
            indexInRegionToCheck++;
        }

        if (indexInRegionToCheck >= regionWidth * regionHeight)
            break;
    }
}

async function sleep(msec) {
    // @ts-ignore
    return new Promise(resolve => setTimeout(resolve, msec));
}
