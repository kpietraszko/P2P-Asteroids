// @ts-ignore Rider's TS compiler works weird compared to Parcel's
// import MainLoop = require("mainloop.js");
import MainLoop from "mainloop.js";
import Peer from "peerjs";
import { BitStream } from "bit-buffer";
import { onPointerDown, onPointerMove, onPointerUp } from "./inputHandlers";
import { getRandomInRange, isPointInCircle, length } from "./mathHelpers";
import { spawnBall, spawnSingle } from "./spawnHelpers";
import { fillImageData } from "./fillImageData";
window.addEventListener("load", onLoaded);
function SetupCanvas() {
    globalThis.canvas = document.getElementById("canvas"); // careful, this means canvas won't ever get GC'ed
    globalThis.particlesColumns = 320;
    globalThis.particlesRows = 200;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    globalThis.canvas.width = globalThis.particlesColumns;
    globalThis.canvas.height = globalThis.particlesRows;
    globalThis.ctx = globalThis.canvas.getContext("2d", { alpha: false });
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";
}
function SetupInputAndOrientation() {
    globalThis.canvas.onpointerdown = onPointerDown;
    globalThis.canvas.onpointermove = onPointerMove;
    globalThis.canvas.onpointerup = onPointerUp;
    let isMobile = () => 'ontouchstart' in document.documentElement && /mobi/i.test(navigator.userAgent);
    let isLandscape = () => screen.orientation.type === "landscape-primary" || screen.orientation.type === "landscape-secondary";
    screen.orientation.addEventListener('change', function (e) {
        if (isMobile() && isLandscape())
            document.documentElement.requestFullscreen();
    });
}
function onLoaded() {
    let menuElement = document.getElementById("menu");
    const peerOptions = {
        config: {
            'iceServers': [
                { urls: 'stun:stun.threatfrom.space:3478 ' },
                { urls: 'turn:turn.threatfrom.space:3478', username: "guest", credential: "somepassword" }
            ]
        },
        debug: 3
    };
    let urlParams = new URLSearchParams(window.location.search); // impossible to do on itch.io, so either the joining player will play outside itch.io, 
    // or also allow joining by entering invite code
    const joinId = urlParams.get("join");
    if (joinId) {
        menuElement.parentNode.removeChild(menuElement);
        const peer = new Peer(peerOptions);
        peer.on('error', function (err) {
            console.log(err);
        });
        peer.on('open', id => {
            console.log("Trying to connect to " + joinId);
            let conn = peer.connect(joinId, { reliable: true, serialization: "none" }); // TODO: change reliable to false after testing, then make sure DataChannel.ordered is also false
            conn.on("open", () => {
                conn.send("JOINER | conn on open");
                conn.on("data", joinerOnData);
                setupGameForJoiner();
            });
        });
        return;
    }
    var hostButton = document.getElementById("hostButton");
    var idElement = document.getElementById("thisPeerId");
    hostButton.addEventListener("click", () => {
        const peer = new Peer(peerOptions);
        peer.on('error', function (err) {
            console.log(err);
        });
        peer.on("open", id => {
            const joinUrl = "https://threatfrom.space?join=" + id;
            idElement.innerText = joinUrl;
            if (navigator.share) {
                idElement.addEventListener("click", () => {
                    navigator.share({
                        title: "Join me in game",
                        url: joinUrl
                    }).then(() => idElement.parentNode.removeChild(idElement));
                });
            }
            peer.on("connection", conn => {
                console.log("HOST | connection callback");
                globalThis.otherPeerConnection = conn;
                setupGameForHost();
                // conn.on("data", data => {
                //     console.log("HOST | Received data: " + data);
                // });
            });
        });
        hostButton.parentNode.removeChild(hostButton);
    });
}
function setupGameForJoiner() {
    SetupCanvas();
    SetupInputAndOrientation();
    globalThis.tick = 1;
    // TODO: warm up (maybe)
    // can't rely on requestAnimationFrame frame rate, any device can limit it to anything like 50, 30 
    // which means update has to be called multiple times per frame
    const kindaTargetFPS = 30;
    MainLoop.setUpdate(joinerUpdate).setDraw(draw).setEnd(end).setMaxAllowedFPS(kindaTargetFPS).setSimulationTimestep(1000.0 / kindaTargetFPS).start();
}
function joinerUpdate(delta) {
    const width = globalThis.canvas.width;
    const height = globalThis.canvas.height;
    if (!globalThis.imageData)
        globalThis.imageData = globalThis.ctx.createImageData(width, height);
    let imageData = globalThis.imageData;
    globalThis.tick++;
}
function joinerOnData(data) {
    // TODO: buffer incoming data, based on its packet's tick. In joinerUpdate pull relevant tick's packet and apply it to imageData
    console.log("JOINER | Received data");
    let bitStream = new BitStream(data);
    let tick = bitStream.readUint32();
    let numberOfFilled = 0;
    let imageData = globalThis.imageData;
    // TODO: move this from here, no buffering for now
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] = 255; // R value
        imageData.data[i + 1] = 255; // G value
        imageData.data[i + 2] = 255; // B value
        imageData.data[i + 3] = 255; // A value
    }
    for (let i = 0; i < imageData.data.length; i += 4) {
        let filled = bitStream.readBoolean();
        if (filled) {
            imageData.data[i] = 0;
            imageData.data[i + 1] = 0;
            imageData.data[i + 2] = 0;
            numberOfFilled++;
        }
    }
    globalThis.imageData = imageData;
    console.log("JOINER | Received " + numberOfFilled + " filled pixels");
}
function SetupPlanet(planetRadius) {
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
}
function setupGameForHost() {
    // TODO: add class/interface to globalThis, that holds all these
    // console.log = function() {}; // DISABLES CONSOLE.LOG
    SetupCanvas();
    SetupInputAndOrientation();
    globalThis.particlesPositionsX = new Float32Array(globalThis.initialParticlesCount); // those are pools of particles
    globalThis.particlesPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesNewPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesAlive = new Array(globalThis.initialParticlesCount).fill(false);
    globalThis.rotationGroupAssignments = new Uint8Array(globalThis.initialParticlesCount).fill(0);
    globalThis.particleTimeToLive = new Uint8Array(globalThis.initialParticlesCount).fill(255); // 255 means infinite
    globalThis.isBullet = new Array(globalThis.initialParticlesCount).fill(false);
    globalThis.previousBulletId = 0;
    globalThis.player1ShootOriginParticle = -1;
    globalThis.player1LastShotTime = 0;
    globalThis.dataToSend = new ArrayBuffer(4 /*tick*/ + (globalThis.particlesColumns * globalThis.particlesRows) / 8); // because 8 bools in a byte
    // max 4 particles per collision cell
    globalThis.particleCollisionLookup = new Array(globalThis.particlesColumns * globalThis.particlesRows).fill(null).map(i => new Int32Array(4));
    globalThis.particleCollisionLookup.forEach(cell => cell.fill(-1));
    globalThis.collisionLookupCountAtCell = new Uint8Array(globalThis.initialParticlesCount);
    globalThis.planetCenterX = 200;
    globalThis.planetCenterY = 100;
    const planetRadius = 40;
    SetupPlanet(planetRadius);
    // await sleep(1000);
    globalThis.tick = 1;
    // TODO: warm up (maybe)
    // can't rely on requestAnimationFrame frame rate, any device can limit it to anything like 50, 30 
    // which means update has to be called multiple times per frame
    const kindaTargetFPS = 30;
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).setMaxAllowedFPS(kindaTargetFPS).setSimulationTimestep(1000.0 / kindaTargetFPS).start();
}
function rotationToVelocity() {
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
            if (isNaN(globalThis.particlesVelocitiesX[i]) || isNaN(globalThis.particlesVelocitiesY[i])) {
                throw new Error("NaN");
            }
        }
    }
}
function handleCollisions() {
    for (let cellIndex = 0; cellIndex < globalThis.particleCollisionLookup.length; cellIndex++) {
        if (globalThis.collisionLookupCountAtCell[cellIndex] <= 1)
            continue;
        let particlesToCheck = globalThis.particleCollisionLookup[cellIndex];
        let firstParticlesRotationGroup = globalThis.rotationGroupAssignments[particlesToCheck[0]];
        let allParticlesSameRotationGroup = true;
        if (firstParticlesRotationGroup === 1) // 1 is planet. workaround for now so that asteroids collide with each other
         {
            for (let j = 1; j < globalThis.collisionLookupCountAtCell[cellIndex]; j++) {
                if (globalThis.rotationGroupAssignments[particlesToCheck[j]] !== firstParticlesRotationGroup) {
                    allParticlesSameRotationGroup = false;
                    break; // BUG: disables collisions between asteroids
                }
            }
            if (allParticlesSameRotationGroup)
                continue;
        }
        let collisionPositionX = globalThis.particlesPositionsX[particlesToCheck[0]];
        let collisionPositionY = globalThis.particlesPositionsY[particlesToCheck[0]];
        let allCollidingAreBullets = globalThis.isBullet[particlesToCheck[0]];
        let anyIsBullet = globalThis.isBullet[particlesToCheck[0]];
        let anyIsPlanet = globalThis.rotationGroupAssignments[particlesToCheck[0]] === 1;
        for (let j = 1; j < globalThis.collisionLookupCountAtCell[cellIndex]; j++) {
            if (globalThis.isBullet[particlesToCheck[j]])
                anyIsBullet = true;
            else
                allCollidingAreBullets = false;
            if (globalThis.rotationGroupAssignments[particlesToCheck[j]] === 1)
                anyIsPlanet = true;
        }
        if (anyIsPlanet || (anyIsBullet && !allCollidingAreBullets)) { // bullets don't destroy bullets
            // bouncing
            // calculate normal
            let bulletParticleIndex = particlesToCheck[0];
            let particleXRounded = Math.round(globalThis.particlesPositionsX[bulletParticleIndex]);
            let particleYRounded = Math.round(globalThis.particlesPositionsY[bulletParticleIndex]);
            let summedDirectionFromNeighboursToParticleX = 0;
            let summedDirectionFromNeighboursToParticleY = 0;
            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y++) {
                    if (x == 0 && y == 0)
                        continue; // ignore the actual particle
                    let neighborAbsoluteX = particleXRounded + x;
                    let neighborAbsoluteY = particleYRounded + y;
                    if (neighborAbsoluteX < 0 || neighborAbsoluteX >= globalThis.particlesColumns || neighborAbsoluteY < 0 || neighborAbsoluteY >= globalThis.particlesRows)
                        continue;
                    let indexOfCollisionLookup = Math.floor(neighborAbsoluteY) * globalThis.particlesColumns + Math.floor(neighborAbsoluteX);
                    if (globalThis.collisionLookupCountAtCell[indexOfCollisionLookup] === 0)
                        continue;
                    summedDirectionFromNeighboursToParticleX += globalThis.particlesPositionsX[bulletParticleIndex] - neighborAbsoluteX;
                    summedDirectionFromNeighboursToParticleY += globalThis.particlesPositionsY[bulletParticleIndex] - neighborAbsoluteY;
                }
            }
            // end of calculating normal
            // this is false for example when colliding with a lonely particle with no neighbors
            let normalLength = length(summedDirectionFromNeighboursToParticleX, summedDirectionFromNeighboursToParticleY);
            if (normalLength !== 0) {
                let nx = summedDirectionFromNeighboursToParticleX / normalLength;
                let ny = summedDirectionFromNeighboursToParticleY / normalLength;
                let dx = globalThis.particlesVelocitiesX[particlesToCheck[1]];
                let dy = globalThis.particlesVelocitiesY[particlesToCheck[1]];
                let bouncedVx = dx - 2 * ((dx * nx) + (dy * ny)) * nx / 2;
                let bouncedVy = dy - 2 * ((dx * nx) + (dy * ny)) * ny / 2;
                if (isNaN(bouncedVx) || isNaN(bouncedVy))
                    throw new Error("NaN");
                if ((Math.abs(bouncedVx) > 0.1 || Math.abs(bouncedVy) > 0.1)) {
                    globalThis.particlesVelocitiesX[particlesToCheck[1]] = bouncedVx;
                    globalThis.particlesVelocitiesY[particlesToCheck[1]] = bouncedVy;
                    globalThis.particleTimeToLive[particlesToCheck[1]] = 20;
                }
            }
            else
                globalThis.particlesAlive[particlesToCheck[1]] = false;
            // kill 1 or 2 from the cell
            globalThis.particlesAlive[particlesToCheck[0]] = false;
            // // if (globalThis.tick % 2 == 0)
            // globalThis.particlesAlive[particlesToCheck[1]] = false;
        }
        // check if player died
        if (!globalThis.particlesAlive[globalThis.player1ShootOriginParticle] && !globalThis.player1Dead) {
            globalThis.player1Dead = true;
            if (window.confirm("YOU DIED. Try again?"))
                window.location.reload();
            console.log("Destroyed shoot origin!");
        }
    }
}
function shoot() {
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
        // console.log("shootOriginX: " + shootOriginX + " shootOriginY: " + shootOriginY);
        let perfectVelocityX = globalThis.pointerX - shootOriginX;
        if (isNaN(perfectVelocityX)) {
            throw new Error("NaN");
        }
        let perfectVelocityY = globalThis.pointerY - shootOriginY;
        let directionOk = true;
        let dotProduct = (perfectVelocityX * shootOriginXRelToPlanetCenter) + (perfectVelocityY * shootOriginYRelToPlanetCenter);
        if (dotProduct < -0.1) {
            // trying to shoot into the planet, don't shoot
            // console.log("ABORT SHOT");
            directionOk = false;
        }
        if (directionOk) {
            //randomize direction a bit for every bullet
            for (let i = 0; i < 5; i++) {
                let angle = getRandomInRange(-0.08, 0.08); // with radius 40 this should amount to linear velocity just below 1 (so slower than bullets)
                let velocityX = (perfectVelocityX) * Math.cos(angle) - perfectVelocityY * Math.sin(angle);
                let velocityY = (perfectVelocityX) * Math.sin(angle) + perfectVelocityY * Math.cos(angle);
                let velocityMagnitude = length(velocityX, velocityY);
                velocityX = velocityX / velocityMagnitude; // normalized
                velocityY = velocityY / velocityMagnitude; // normalized
                if (isNaN(velocityX) || isNaN(velocityY)) {
                    throw new Error("NaN velocity");
                }
                spawnSingle(shootOriginX + velocityX * 4, shootOriginY + velocityY * 4, velocityX, velocityY, true);
            }
        }
    }
}
function applyVelocityAndFillCollisionLookup() {
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i]) {
            continue;
        }
        let prevX = globalThis.particlesPositionsX[i].valueOf();
        let prevY = globalThis.particlesPositionsY[i].valueOf();
        let newX = prevX + globalThis.particlesVelocitiesX[i];
        let newY = prevY + globalThis.particlesVelocitiesY[i];
        globalThis.particlesNewPositionsX[i] = newX;
        globalThis.particlesNewPositionsY[i] = newY;
        let newPosOutsideGrid = newX < 0 || newX >= globalThis.particlesColumns || newY < 0 || newY >= globalThis.particlesRows;
        let prevPosOutsideGrid = prevX < 0 || prevX >= globalThis.particlesColumns || prevY < 0 || prevY >= globalThis.particlesRows;
        if (!prevPosOutsideGrid && newPosOutsideGrid) {
            globalThis.particlesAlive[i] = false;
            continue;
        }
        let indexOfCollisionLookup = Math.floor(newY) * globalThis.particlesColumns + Math.floor(newX);
        if (globalThis.collisionLookupCountAtCell[indexOfCollisionLookup] >= 4) {
            continue; // collision cell is full
        }
        if (!newPosOutsideGrid) {
            globalThis.particleCollisionLookup[indexOfCollisionLookup][globalThis.collisionLookupCountAtCell[indexOfCollisionLookup]] = i;
            globalThis.collisionLookupCountAtCell[indexOfCollisionLookup]++;
        }
    }
}
function applyNewPositions() {
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (isNaN(globalThis.particlesNewPositionsX[i]))
            throw new Error("NaN in new positions");
        globalThis.particlesPositionsX[i] = globalThis.particlesNewPositionsX[i].valueOf();
        globalThis.particlesPositionsY[i] = globalThis.particlesNewPositionsY[i].valueOf();
        globalThis.particlesNewPositionsX[i] = 0;
        globalThis.particlesNewPositionsY[i] = 0;
    }
}
function update(delta) {
    let frameStartTimestamp = performance.now();
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (globalThis.particleTimeToLive[i] !== 255) {
            globalThis.particleTimeToLive[i]--;
            globalThis.particlesVelocitiesX[i] *= 0.96;
            globalThis.particlesVelocitiesY[i] *= 0.96;
        }
        if (globalThis.particleTimeToLive[i] === 0)
            globalThis.particlesAlive[i] = false;
    }
    rotationToVelocity();
    applyVelocityAndFillCollisionLookup();
    handleCollisions();
    // clean up collision lookup
    for (let i = 0; i < globalThis.particleCollisionLookup.length; i++) {
        for (let j = 0; j < globalThis.particleCollisionLookup[i].length; j++) {
            globalThis.particleCollisionLookup[i][j] = -1; // is that right?
        }
        globalThis.collisionLookupCountAtCell[i] = 0;
    }
    if (globalThis.tick == 1) {
        spawnBall(0, 12, 11, 1 / 5, 0.4 / 5); // if speed is too low, the asteroid doesn't damage the planet for some reason
        spawnBall(0, 80, 16, 1 / 5, 0.1 / 5); // or does it, but does it so equally around the rim that I don't notice?
        spawnBall(42, 170, 20, 1, -0.2);
    }
    // shoot
    if (globalThis.isShooting) {
        shoot();
    }
    applyNewPositions();
    fillImageData();
    sendData();
    globalThis.tick++;
    /*if (globalThis.tick % 60 == 0)
        console.warn("PERF | Update " + (performance.now() - frameStartTimestamp) + "ms");

    if (globalThis.tick % 60 == 0)
        console.log("DEBUG | Dead particles in pool: " + globalThis.particlesAlive.filter(x => !x).length);*/
}
function sendData() {
    let bitStream = new BitStream(globalThis.dataToSend);
    const imageData = globalThis.imageData;
    let numberOfFilled = 0;
    bitStream.writeUint32(globalThis.tick);
    for (let i = 0; i < imageData.data.length; i += 4) {
        let filled = imageData.data[i] !== 255;
        bitStream.writeBoolean(filled);
        if (filled)
            numberOfFilled++;
    }
    globalThis.otherPeerConnection.send(bitStream.buffer);
    console.log("HOST | Sent " + numberOfFilled + " filled pixels");
}
function draw(interpolationPercentage) {
    if (globalThis.imageData)
        globalThis.ctx.putImageData(globalThis.imageData, 0, 0); // this has zero performance impact
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
//# sourceMappingURL=asteroids.js.map