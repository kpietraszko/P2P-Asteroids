"use strict";
// import * as MainLoop from "mainloop.js";
// import MainLoop = require("mainloop.js");
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// import * as MainLoop from "./node_modules/mainloop.js/build/mainloop.min.js";
var gpu_js_1 = require("gpu.js");
// @ts-ignore Rider's TS compiler works weird compared to Parcel's
var MainLoop = require("mainloop.js");
document.addEventListener("DOMContentLoaded", onDOMLoaded);
var gpu = new gpu_js_1.GPU({ mode: "gpu" }); // for now CPU is like 2 times faster than GPU, because copying data to and from GPU is slow at this scale :(. 
// TODO: implement second graphical kernel that draws straight to canvas and check performance
// returns x or y position of given particle, depending on given thread.x and thread.y
// [fakeY, fakeX] for fake transformation of particles to 2D array. thread.z should be (XorY result)
function velocityKernelFunction(particlesPositionsX, particlesPositionsY, // these should probably be Float32Array[]
particlesVelocitiesX, particlesVelocitiesY, particlesAlive) {
    if (particlesAlive[this.thread.y][this.thread.x] == 0) // 0 is dead, 1 is alive
        return 0;
    var coordinate = this.thread.z;
    var particlePositionX = particlesPositionsX[this.thread.y][this.thread.x];
    var particlePositionY = particlesPositionsY[this.thread.y][this.thread.x];
    if (coordinate == 0) // 0 means we want X, 1 means we want Y
        return particlePositionX + particlesVelocitiesX[this.thread.y][this.thread.x];
    return particlePositionY + particlesVelocitiesY[this.thread.y][this.thread.x];
}
globalThis.velocityKernel = gpu.createKernel(velocityKernelFunction).setImmutable(true).setOutput([240, 320, 2]);
function onDOMLoaded() {
    globalThis.canvas = document.getElementById("canvas"); // careful, this means canvas won't ever get GC'ed
    globalThis.fpsCounter = document.getElementById("fps");
    globalThis.particlesColumns = 320;
    globalThis.particlesRows = 200;
    globalThis.initialParticlesCount = globalThis.particlesColumns * globalThis.particlesRows;
    // (<IKernelRunShortcutBase>globalThis.velocityKernel).setOutput([globalThis.particlesColumns, globalThis.particlesRows, 2]);
    globalThis.particleDisplaySize = 3;
    globalThis.canvas.width = globalThis.particlesColumns * globalThis.particleDisplaySize;
    globalThis.canvas.height = globalThis.particlesRows * globalThis.particleDisplaySize;
    globalThis.ctx = globalThis.canvas.getContext("2d");
    globalThis.ctx.imageSmoothingEnabled = false;
    globalThis.ctx.fillStyle = "black";
    globalThis.particlesPositionsX = new Float32Array(globalThis.initialParticlesCount); // change those to Float32Array
    globalThis.particlesPositionsY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesX = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesVelocitiesY = new Float32Array(globalThis.initialParticlesCount);
    globalThis.particlesAlive = new Float32Array(globalThis.initialParticlesCount); // 0 is dead, 1 is alive (gpu.js doesn't take boolean[] as input)
    var planetCenterX = 50;
    var planetCenterY = 100;
    var planetRadius = 40;
    for (var i = 0; i < globalThis.initialParticlesCount; i++) {
        var x = Math.floor(i % globalThis.particlesColumns); // why floor?
        var y = Math.floor(i / globalThis.particlesColumns);
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
    MainLoop.setUpdate(update).setDraw(draw).setEnd(end).setMaxAllowedFPS().setSimulationTimestep(1000.0 / 60).start();
}
function update(delta) {
    // console.log("update");
    // note that arrays here are transformed to 2D but this has no relation to the actual positions of particles
    // it's just required to fit into kernel's textures
    var result = globalThis.velocityKernel(new gpu_js_1.Input(globalThis.particlesPositionsX, [globalThis.particlesColumns, globalThis.particlesRows]), new gpu_js_1.Input(globalThis.particlesPositionsY, [globalThis.particlesColumns, globalThis.particlesRows]), new gpu_js_1.Input(globalThis.particlesVelocitiesX, [globalThis.particlesColumns, globalThis.particlesRows]), new gpu_js_1.Input(globalThis.particlesVelocitiesY, [globalThis.particlesColumns, globalThis.particlesRows]), new gpu_js_1.Input(globalThis.particlesAlive, [globalThis.particlesColumns, globalThis.particlesRows]));
    // console.log(result);
    for (var z = 0; z < result.length; z++) { // are these loops correct?
        for (var y = 0; y < result[0].length; y++) {
            for (var x = 0; x < result[0][0].length; x++) {
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
function draw(interpolationPercentage) {
    // for (let y = 0; y < globalThis.particlesRows; y++) {
    //     for (let x = 0; x < globalThis.particlesColumns; x++) {
    //        
    //     }
    // }
    globalThis.ctx.clearRect(0, 0, globalThis.canvas.width, globalThis.canvas.height);
    for (var i = 0; i < globalThis.particlesPositionsX.length; i++) {
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
        var discardedTime = Math.round(MainLoop.resetFrameDelta());
        console.warn('Main loop panicked, probably because the browser tab was put in the background. Discarding ' + discardedTime + 'ms');
    }
}
function isPointInCircle(x, y, centerX, centerY, radius) {
    return (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) < (radius + 0.5) * (radius + 0.5); // 0.25 or 0.5 or 0.7071?
}
function sleep(msec) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // @ts-ignore
            return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, msec); })];
        });
    });
}
