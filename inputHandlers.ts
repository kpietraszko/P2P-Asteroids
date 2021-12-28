export function onPointerDown(event: PointerEvent) {
    // console.warn("pointer down");
    globalThis.isShooting = true;

    // also setting position here to avoid undefined pointerX between Down and Move calls
    const canvasWidth = (event.target as HTMLElement).offsetWidth;
    const canvasHeight = (event.target as HTMLElement).offsetHeight;
    globalThis.pointerX = event.offsetX / canvasWidth * globalThis.particlesColumns;
    globalThis.pointerY = event.offsetY / canvasHeight * globalThis.particlesRows;
}

export function onPointerMove(event: PointerEvent) {
    // console.warn("pointer move");
    // includes canvas scale
    const canvasWidth = (event.target as HTMLElement).offsetWidth;
    const canvasHeight = (event.target as HTMLElement).offsetHeight;
    globalThis.pointerX = event.offsetX / canvasWidth * globalThis.particlesColumns;
    globalThis.pointerY = event.offsetY / canvasHeight * globalThis.particlesRows;
}

export function onPointerUp(event: PointerEvent) {
    // console.log("pointer up");
    globalThis.isShooting = false;
}