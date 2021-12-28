export function isPointInCircle(x: number, y: number, centerX: number, centerY: number, radius: number): boolean {
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5);
}

export function length(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
}

export function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}