export class PerformanceOptimizer {
    constructor() {
        this.isLowEndDevice = this.detectLowEndDevice();
        this.audioLatency = this.measureAudioLatency();
        this.frameDropThreshold = 5; // consecutive dropped frames before optimization
        this.droppedFrames = 0;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.minFPS = 30;
        
        // Quality settings
        this.visualQuality = this.isLowEndDevice ? 0.5 : 1.0;
        this.audioComplexity = this.isLowEndDevice ? 0.5 : 1.0;
        
        console.log(`Performance: ${this.isLowEndDevice ? 'Low-end' : 'High-end'} device detected`);
    }
    
    detectLowEndDevice() {
        // Check various indicators of device performance
        const indicators = {
            // Memory (less than 4GB likely low-end)
            memory: navigator.deviceMemory ? navigator.deviceMemory < 4 : false,
            
            // CPU cores (less than 4 likely low-end)
            cores: navigator.hardwareConcurrency ? navigator.hardwareConcurrency < 4 : false,
            
            // Connection type (slow connection may indicate low-end device)
            connection: navigator.connection ? 
                ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType) : false,
            
            // User agent hints for mobile/low-end
            mobile: /Mobi|Android/i.test(navigator.userAgent),
            
            // Canvas performance test
            canvasTest: this.performCanvasTest()
        };
        
        // Count indicators pointing to low-end device
        const lowEndCount = Object.values(indicators).filter(Boolean).length;
        return lowEndCount >= 2;
    }
    
    performCanvasTest() {
        // Quick canvas performance test
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return true; // Assume low-end if no canvas support
        
        const startTime = performance.now();
        
        // Perform some intensive drawing operations
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `hsl(${i % 360}, 50%, 50%)`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 10, 10);
        }
        
        const endTime = performance.now();
        return (endTime - startTime) > 50; // More than 50ms indicates low performance
    }
    
    measureAudioLatency() {
        // Estimate audio latency based on browser and system
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('chrome')) {
            return this.isLowEndDevice ? 64 : 32; // Chrome generally has good latency
        } else if (userAgent.includes('firefox')) {
            return this.isLowEndDevice ? 128 : 64; // Firefox can have higher latency
        } else if (userAgent.includes('safari')) {
            return this.isLowEndDevice ? 128 : 64; // Safari varies
        } else {
            return this.isLowEndDevice ? 256 : 128; // Conservative default
        }
    }
    
    getOptimalAudioSettings() {
        const baseSettings = {
            sampleRate: 44100,
            bufferSize: this.audioLatency,
            maxVoices: this.isLowEndDevice ? 3 : 5,
            
            // Effect settings
            reverbLength: this.isLowEndDevice ? 1.0 : 2.0, // seconds
            chorusVoices: this.isLowEndDevice ? 1 : 2,
            oversample: this.isLowEndDevice ? '2x' : '4x'
        };
        
        return baseSettings;
    }
    
    getOptimalVisualSettings() {
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, this.isLowEndDevice ? 1.5 : 2);
        
        return {
            pixelRatio: devicePixelRatio,
            shaderComplexity: this.visualQuality,
            animationDetail: this.isLowEndDevice ? 'low' : 'high',
            touchHistorySize: this.isLowEndDevice ? 25 : 50,
            
            // WebGL settings
            antialias: !this.isLowEndDevice,
            powerPreference: this.isLowEndDevice ? 'low-power' : 'high-performance'
        };
    }
    
    startFrameMonitoring(callback) {
        this.frameCallback = callback;
        this.monitorFrame();
    }
    
    monitorFrame() {
        const now = performance.now();
        
        if (this.lastFrameTime > 0) {
            const frameDelta = now - this.lastFrameTime;
            const expectedDelta = 1000 / this.targetFPS;
            
            if (frameDelta > expectedDelta * 1.5) {
                this.droppedFrames++;
                
                if (this.droppedFrames >= this.frameDropThreshold) {
                    this.optimizeForPerformance();
                    this.droppedFrames = 0;
                }
            } else {
                this.droppedFrames = Math.max(0, this.droppedFrames - 1);
            }
            
            if (this.frameCallback) {
                const fps = 1000 / frameDelta;
                this.frameCallback(fps, frameDelta);
            }
        }
        
        this.lastFrameTime = now;
        requestAnimationFrame(() => this.monitorFrame());
    }
    
    optimizeForPerformance() {
        console.log('Performance drop detected, optimizing...');
        
        // Reduce visual quality
        this.visualQuality = Math.max(0.25, this.visualQuality * 0.8);
        
        // Reduce audio complexity
        this.audioComplexity = Math.max(0.25, this.audioComplexity * 0.9);
        
        // Notify components to reduce quality
        document.dispatchEvent(new CustomEvent('performance-optimize', {
            detail: {
                visualQuality: this.visualQuality,
                audioComplexity: this.audioComplexity
            }
        }));
    }
    
    // Battery optimization
    handleBatteryChange(battery) {
        if (battery.level < 0.2 || battery.dischargingTime < 3600) {
            // Low battery - reduce performance
            console.log('Low battery detected, reducing performance');
            this.targetFPS = 30;
            this.visualQuality *= 0.7;
            this.audioComplexity *= 0.8;
        }
    }
    
    async initBatteryMonitoring() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.handleBatteryChange(battery);
                
                battery.addEventListener('levelchange', () => this.handleBatteryChange(battery));
                battery.addEventListener('dischargingtimechange', () => this.handleBatteryChange(battery));
            } catch (error) {
                console.log('Battery API not available');
            }
        }
    }
    
    // Memory management
    requestIdleCallback(callback, timeout = 1000) {
        if (window.requestIdleCallback) {
            return window.requestIdleCallback(callback, { timeout });
        } else {
            // Fallback for browsers without requestIdleCallback
            return setTimeout(() => {
                const start = performance.now();
                callback({
                    didTimeout: false,
                    timeRemaining() {
                        return Math.max(0, 50 - (performance.now() - start));
                    }
                });
            }, 0);
        }
    }
    
    // Throttle function calls based on performance
    throttle(func, wait) {
        let timeout;
        let lastExecTime = 0;
        
        return function executedFunction(...args) {
            const elapsed = performance.now() - lastExecTime;
            
            const execute = () => {
                lastExecTime = performance.now();
                func.apply(this, args);
            };
            
            if (elapsed > wait) {
                execute();
            } else {
                clearTimeout(timeout);
                timeout = setTimeout(execute, wait - elapsed);
            }
        };
    }
    
    // Adaptive quality based on current performance
    getAdaptiveQuality(currentFPS) {
        if (currentFPS >= this.targetFPS * 0.9) {
            // Good performance - can increase quality
            return Math.min(1.0, this.visualQuality * 1.1);
        } else if (currentFPS < this.minFPS) {
            // Poor performance - reduce quality
            return Math.max(0.25, this.visualQuality * 0.9);
        }
        
        return this.visualQuality;
    }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();