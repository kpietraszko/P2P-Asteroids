window.addEventListener("load", onLoaded);
function onLoaded() {
    // TODO: add class/interface to globalThis, that holds all these
    globalThis.canvas = document.getElementById("canvas"); // careful, this means canvas won't ever get GC'ed
    globalThis.fpsCounter = document.getElementById("fps");
    globalThis.particlesColumns = 320;
    globalThis.particlesRows = 200;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    globalThis.canvas.width = globalThis.particlesColumns;
    globalThis.canvas.height = globalThis.particlesRows;
    globalThis.ctx = globalThis.canvas.getContext("2d", { alpha: false });
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";
    globalThis.canvas.onpointerdown = onPointerDown;
    let isMobile = window.matchMedia("only screen and (max-width: 480px)").matches;
    screen.orientation.addEventListener('change', function (e) {
        if (window.matchMedia("only screen and (max-height: 4200px)").matches && (screen.orientation.type === "landscape-primary" || screen.orientation.type === "landscape-secondary"))
            document.documentElement.requestFullscreen();
    });
    globalThis.particlesPositionsX = new Float32Array(globalThis.initialParticlesCount); // TODO: those are pools of particles
    globalThis.particlesPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesAlive = new Array(globalThis.initialParticlesCount).fill(false);
    globalThis.rotationGroupAssignments = new Uint8Array(globalThis.initialParticlesCount).fill(0);
    globalThis.player1ShootOriginParticle = -1;
    // max 4 particles per collision cell
    globalThis.particleCollisionLookup = new Array(globalThis.particlesColumns * globalThis.particlesRows).fill(null).map(i => new Int32Array(4));
    globalThis.particleCollisionLookup.forEach(cell => cell.fill(-1));
    globalThis.collisionLookupCountAtCell = new Uint8Array(globalThis.initialParticlesCount);
    globalThis.planetCenterX = 200;
    globalThis.planetCenterY = 100;
    const planetRadius = 40;
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        let x = Math.floor(i % globalThis.particlesColumns); // why floor?
        let y = Math.floor(i / globalThis.particlesColumns);
        if (isPointInCircle(x, y, globalThis.planetCenterX, globalThis.planetCenterY, planetRadius) ||
            (x > globalThis.planetCenterX - 2 && x < globalThis.planetCenterX + 2 && y > globalThis.planetCenterY - planetRadius - 6 && y < globalThis.planetCenterY)) {
            globalThis.particlesAlive[i] = true;
            // globalThis.particlesVelocitiesX[i] = 1.0;
            globalThis.particlesPositionsX[i] = x;
            globalThis.particlesPositionsY[i] = y;
            globalThis.rotationGroupAssignments[i] = 1;
            if (x === globalThis.planetCenterX && y === globalThis.planetCenterY - planetRadius - 5) {
                globalThis.player1ShootOriginParticle = i;
                console.log("player1ShootOriginParticle: " + x + " " + y);
            }
        }
    }
    // await sleep(1000);
    globalThis.tick = 1;
    // warm up (maybe)
    // Problem, intentionally MainLoop is often called twice in a frame
    // Don't pass anything to setMaxAllowedFPS to prevent that. 
    // Set SimulationTimestep to 1000/60 to update and draw 60 times per second, or to 1000/30 to draw 60 times per second and update 30 times 
    // seems like update is still called multiple times per frame, possibly also spiral of death
    // can't rely on requestAnimationFrame frame rate, any device can limit it to anything like 50, 30 
    // which means update has to be called multiple times per frame
    const kindaTargetFPS = 60;
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).setMaxAllowedFPS(kindaTargetFPS).setSimulationTimestep(1000.0 / kindaTargetFPS).start();
}
function update(delta) {
    // rotation to velocity
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i])
            continue;
        if (globalThis.rotationGroupAssignments[i] === 0)
            continue;
        let x = globalThis.particlesPositionsX[i];
        let y = globalThis.particlesPositionsY[i];
        if (globalThis.rotationGroupAssignments[i] === 1) {
            let pivotX = globalThis.planetCenterX;
            let pivotY = globalThis.planetCenterY;
            const angle = -0.024; // with radius 40 this should amount to linear velocity just below 1 (so slower than bullets)
            let xr = (x - pivotX) * Math.cos(angle) - (y - pivotY) * Math.sin(angle) + pivotX;
            let yr = (x - pivotX) * Math.sin(angle) + (y - pivotY) * Math.cos(angle) + pivotY;
            globalThis.particlesVelocitiesX[i] = xr - x;
            globalThis.particlesVelocitiesY[i] = yr - y;
        }
    }
    // apply velocity and fill particle collision lookup
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i]) {
            continue;
        }
        let prevX = globalThis.particlesPositionsX[i];
        let prevY = globalThis.particlesPositionsY[i];
        let newX = prevX + globalThis.particlesVelocitiesX[i];
        let newY = prevY + globalThis.particlesVelocitiesY[i];
        globalThis.particlesNewPositionsX[i] = newX;
        globalThis.particlesNewPositionsY[i] = newY;
        // TODO: change it to check if it was inside grid on previous tick and now isn't, then kill it
        let newPosOutsideGrid = newX < 0 || newX >= globalThis.particlesColumns || newY < 0 || newY >= globalThis.particlesRows;
        let prevPosOutsideGrid = prevX < 0 || prevX >= globalThis.particlesColumns || prevY < 0 || prevY >= globalThis.particlesRows;
        if (!prevPosOutsideGrid && newPosOutsideGrid) {
            globalThis.particlesAlive[i] = false;
            continue;
        }
        let indexOfCollisionLookup = Math.floor(newY) * globalThis.particlesColumns + Math.round(newX);
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
        if (firstParticlesRotationGroup === 1) // 1 is planet. workaround for now so that asteroids collide with each other
         {
            for (let j = 1; j < globalThis.collisionLookupCountAtCell[i]; j++) {
                if (globalThis.rotationGroupAssignments[particlesToCheck[j]] !== firstParticlesRotationGroup) {
                    allParticlesSameRotationGroup = false;
                    break; // BUG: disables collisions between asteroids
                }
            }
            if (allParticlesSameRotationGroup)
                continue;
        }
        for (let j = 0; j < globalThis.collisionLookupCountAtCell[i]; j++) {
            globalThis.particlesAlive[particlesToCheck[j]] = false;
            if (particlesToCheck[j] === globalThis.player1ShootOriginParticle) {
                if (window.confirm("YOU DIED. Try again?"))
                    window.location.reload();
                console.log("Destroyed shoot origin! Probably because the planet (and so the 'cannon') rotated into the bullet it just shot.");
            }
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
        spawnBall(0, 12, 11, 1 / 5, 0.4 / 5); // if speed is to low, the asteroid doesn't damage the planet for some reason
        spawnBall(0, 80, 16, 1 / 5, 0.1 / 5); // or does it, but does it so equally around the rim that I don't notice?
        spawnBall(42, 170, 20, 1, -0.2);
    }
    // shoot
    if (globalThis.clickNotYetHandled) {
        globalThis.clickNotYetHandled = false;
        let shootOriginX = globalThis.particlesPositionsX[globalThis.player1ShootOriginParticle];
        let shootOriginY = globalThis.particlesPositionsY[globalThis.player1ShootOriginParticle];
        let originOk = true;
        if (shootOriginX === 0 && shootOriginY === 0 || !globalThis.particlesAlive[globalThis.player1ShootOriginParticle]) {
            console.log("shoot origin particle is dead or something, can't shoot");
            originOk = false;
        }
        if (originOk) {
            let shootOriginXRelToPlanetCenter = shootOriginX - globalThis.planetCenterX;
            let shootOriginYRelToPlanetCenter = shootOriginY - globalThis.planetCenterY;
            let shootOriginRelToPlanetCenterLength = length(shootOriginXRelToPlanetCenter, shootOriginYRelToPlanetCenter);
            shootOriginXRelToPlanetCenter = shootOriginXRelToPlanetCenter / shootOriginRelToPlanetCenterLength;
            shootOriginYRelToPlanetCenter = shootOriginYRelToPlanetCenter / shootOriginRelToPlanetCenterLength;
            console.log("shootOriginX: " + shootOriginX + " shootOriginY: " + shootOriginY);
            let velocityX = globalThis.pointerClickX - shootOriginX;
            let velocityY = globalThis.pointerClickY - shootOriginY;
            let velocityMagnitude = length(velocityX, velocityY);
            velocityX = velocityX / velocityMagnitude; // normalized
            velocityY = velocityY / velocityMagnitude; // normalized
            let directionOk = true;
            let dotProduct = (velocityX * shootOriginXRelToPlanetCenter) + (velocityY * shootOriginYRelToPlanetCenter);
            if (dotProduct < -0.1) {
                // trying to shoot into the planet, don't shoot
                console.log("ABORT SHOT");
                directionOk = false;
            }
            if (directionOk) {
                // find dead particle(s) in pool, give it velocity according to click position
                // region single pixel bullet
                /*for (let i = 0; i < globalThis.initialParticlesCount; i++) {
                    if (i === globalThis.initialParticlesCount - 1) {
                        console.log("no dead particles in pool, can't shoot");
                    }

                    if (globalThis.particlesAlive[i])
                        continue; // this particle is already used for something

                    globalThis.particlesVelocitiesX[i] = velocityX;
                    globalThis.particlesVelocitiesY[i] = velocityY;

                    // offset the initial bullet position to avoid destroying shoot origin particle itself
                    
                    globalThis.particlesPositionsX[i] = shootOriginX + velocityX * 3;
                    globalThis.particlesPositionsY[i] = shootOriginY + velocityY * 3;
                    globalThis.particlesAlive[i] = true;
                    break;
                }*/
                // endregion
                spawnBall(shootOriginX + velocityX * 6, shootOriginY + velocityY * 6, 3, velocityX, velocityY);
            }
        }
    }
    // apply new positions to positions arrays, and clear newPositions arrays; also store prevTickPositions
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        globalThis.particlesPositionsX[i] = globalThis.particlesNewPositionsX[i].valueOf();
        globalThis.particlesPositionsY[i] = globalThis.particlesNewPositionsY[i].valueOf();
        globalThis.particlesNewPositionsX[i] = 0;
        globalThis.particlesNewPositionsY[i] = 0;
    }
    globalThis.tick++;
}
function draw(interpolationPercentage) {
    // console.log("alive: " +globalThis.particlesAlive.filter(x => x == true).length);
    const width = globalThis.canvas.width;
    const height = globalThis.canvas.height;
    let imageData = globalThis.ctx.createImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] = 255; // R value
        imageData.data[i + 1] = 255; // G value
        imageData.data[i + 2] = 255; // B value
        imageData.data[i + 3] = 255; // A value
    }
    // draw a grey trail for every particle, consisting of 1-3 pixels behind the particle (so opposite of velocity)
    // this will be slooow
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i])
            continue;
        if (globalThis.particlesVelocitiesX === 0 && globalThis.particlesVelocitiesY === 0)
            continue;
        if (globalThis.rotationGroupAssignments[i] !== 1) // only draw trails for planet
            continue;
        let velocityMagnitude = length(globalThis.particlesVelocitiesX[i], globalThis.particlesVelocitiesY[i]);
        let velocityXNormalized = globalThis.particlesVelocitiesX[i] / velocityMagnitude;
        let velocityYNormalized = globalThis.particlesVelocitiesY[i] / velocityMagnitude;
        let particleXRounded = Math.round(globalThis.particlesPositionsX[i]);
        let particleYRounded = Math.round(globalThis.particlesPositionsY[i]);
        if (particleXRounded < 0 || particleXRounded >= width || particleYRounded < 0 || particleYRounded >= height)
            continue;
        // iterate over moore neighborhood, if dot product of that (pixel in relation to the particle, velocity) is < -0.1 draw grey
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x == 0 && y == 0)
                    continue; // ignore the actual particle
                let neighborAbsoluteX = particleXRounded + x;
                let neighborAbsoluteY = particleYRounded + y;
                if (neighborAbsoluteX < 0 || neighborAbsoluteX >= width || neighborAbsoluteY < 0 || neighborAbsoluteY >= height)
                    continue;
                let neighborLength = length(x, y);
                let dotProduct = (velocityXNormalized * (x / neighborLength)) + (velocityYNormalized * (y / neighborLength));
                if (dotProduct < -0.4) {
                    let offset = (neighborAbsoluteY * width + neighborAbsoluteX) * 4;
                    imageData.data[offset + 0] = 0;
                    imageData.data[offset + 1] = 0;
                    imageData.data[offset + 2] = 0;
                }
            }
        }
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
function end(fps, panic) {
    // globalThis.fpsCounter.textContent = Math.round(fps) + ' FPS';
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
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5);
}
function spawnBall(centerX, centerY, r, vx, vy) {
    const minX = centerX - r; // maybe also -0.5
    const maxX = centerX + r + 1; // maybe also +0.5
    const minY = centerY - r; // maybe also -0.5
    const maxY = centerY + r + 1; // maybe also +0.5
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    let indexInRegionToCheck = 0;
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (globalThis.particlesAlive[i])
            continue; // this particle is already used for something
        let foundPixelForThisParticle = false;
        while (!foundPixelForThisParticle && indexInRegionToCheck < regionWidth * regionHeight) {
            let x = Math.floor(indexInRegionToCheck % regionWidth) + minX; // why floor? // regionHeight or regionWidth?
            let y = Math.floor(indexInRegionToCheck / regionWidth) + minY;
            if (isPointInCircle(x, y, centerX, centerY, r)) {
                globalThis.particlesAlive[i] = true;
                globalThis.particlesVelocitiesX[i] = vx;
                globalThis.particlesVelocitiesY[i] = vy;
                globalThis.particlesNewPositionsX[i] = x;
                globalThis.particlesNewPositionsY[i] = y;
                foundPixelForThisParticle = true;
                if (i == 0)
                    console.log("index " + i + " at " + x + "; " + y);
            }
            indexInRegionToCheck++;
        }
        if (indexInRegionToCheck >= regionWidth * regionHeight)
            break;
    }
}
function length(x, y) {
    return Math.sqrt(x * x + y * y);
}
async function sleep(msec) {
    // @ts-ignore
    return new Promise(resolve => setTimeout(resolve, msec));
}
function onPointerDown(event) {
    // console.log("pointer down");
    // includes canvas scale
    const canvasWidth = event.target.offsetWidth;
    const canvasHeight = event.target.offsetHeight;
    console.log("pointer down at " + event.offsetX / canvasWidth + "; " + event.offsetY / canvasHeight);
    globalThis.pointerClickX = event.offsetX / canvasWidth * globalThis.particlesColumns;
    globalThis.pointerClickY = event.offsetY / canvasHeight * globalThis.particlesRows;
    globalThis.clickNotYetHandled = true;
}
export {};
//# sourceMappingURL=asteroids.js.map