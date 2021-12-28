import {isPointInCircle} from "./mathHelpers";

export function spawnBall(centerX: number, centerY: number, r: number, vx: number, vy: number, isBullet = false): void {
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
                globalThis.particleTimeToLive[i] = 255;
                globalThis.isBullet[i] = isBullet;
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

export function spawnSingle(x: number, y: number, vx: number, vy: number, isBullet = false): void {
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (globalThis.particlesAlive[i])
            continue; // this particle is already used for something

        globalThis.particlesAlive[i] = true;
        globalThis.particlesVelocitiesX[i] = vx;
        globalThis.particlesVelocitiesY[i] = vy;
        globalThis.particlesNewPositionsX[i] = x;
        globalThis.particlesNewPositionsY[i] = y;
        globalThis.particleTimeToLive[i] = 255;
        globalThis.isBullet[i] = isBullet;
        return;
    }

    console.error("spawnSingle failed: no free particle found");
}