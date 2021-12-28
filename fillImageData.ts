import {length} from "./mathHelpers";

export function fillImageData(): void { // with fillRect takes ~3 ms, with setImageData takes ~0.5 ms on my PC, ~1.3 ms with planet trail
    const width = globalThis.canvas.width;
    const height = globalThis.canvas.height;
    if (!globalThis.imageData)
        globalThis.imageData = globalThis.ctx.createImageData(width, height);
    let imageData = globalThis.imageData;

    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i + 0] = 255;  // R value
        imageData.data[i + 1] = 255;    // G value
        imageData.data[i + 2] = 255;  // B value
        imageData.data[i + 3] = 255;  // A value
    }

    // draw a grey trail for every particle, consisting of 1-3 pixels behind the particle (so opposite of velocity)
    for (let i = 0; i < globalThis.initialParticlesCount; i++) {
        if (!globalThis.particlesAlive[i])
            continue;

        if (globalThis.particlesVelocitiesX[i] === 0 && globalThis.particlesVelocitiesY[i] === 0)
            continue

        if (globalThis.rotationGroupAssignments[i] !== 1) // only draw trails for planet
            continue;

        let velocityMagnitude = length(globalThis.particlesVelocitiesX[i], globalThis.particlesVelocitiesY[i]);
        let velocityXNormalized = globalThis.particlesVelocitiesX[i] / velocityMagnitude;
        let velocityYNormalized = globalThis.particlesVelocitiesY[i] / velocityMagnitude;

        let particleXRounded = Math.round(globalThis.particlesPositionsX[i]);
        let particleYRounded = Math.round(globalThis.particlesPositionsY[i]);

        if (particleXRounded < 0 || particleXRounded >= width || particleYRounded < 0 || particleYRounded >= height)
            continue;

        // iterate over moore neighborhood, if dot product of that (pixel in relation to the particle, velocity) is < -0.4 draw grey
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

        if (globalThis.particleTimeToLive[i] < 255) {
            imageData.data[offset] = 70;
            imageData.data[offset + 1] = 70;
            imageData.data[offset + 2] = 70;
        }
    }

    globalThis.imageData = imageData;
}