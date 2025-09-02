import { Synthesizer } from './audio/synthesizer.js';
import { OilSurface } from './visual/oil-surface.js';
import { TouchHandler } from './controls/touch-handler.js';
import { createKnobControls } from './controls/knob-control.js';
import { performanceOptimizer } from './utils/performance.js';

class OilSynth {
    constructor() {
        this.synthesizer = null;
        this.oilSurface = null;
        this.touchHandler = null;
        this.knobControls = [];
        
        this.isInitialized = false;
        this.activeVoices = new Map(); // Map touch ID to voice
        
        // DOM elements
        this.canvas = null;
        this.instructionText = null;
        this.controlsPanel = null;
        this.hasStarted = false;
        
        // Performance monitoring
        this.lastFrameTime = 0;
        this.frameCount = 0;
    }
    
    async initialize() {
        console.log('Initializing Oil Synth...');
        
        // Get DOM elements
        this.canvas = document.getElementById('oil-surface');
        this.instructionText = document.getElementById('instruction-text');
        this.controlsPanel = document.getElementById('controls-panel');
        
        if (!this.canvas || !this.instructionText) {
            throw new Error('Required DOM elements not found');
        }
        
        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Prevent zoom on mobile
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
        
        // Initialize components immediately
        await this.start();
        
        console.log('Oil Synth initialized, ready for first touch...');
    }
    
    async start() {
        if (this.isInitialized) return;
        
        try {
            console.log('Starting Oil Synth components...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup interactions
            this.setupTouchInteraction();
            this.setupKnobControls();
            
            this.isInitialized = true;
            console.log('Oil Synth ready!');
            
        } catch (error) {
            console.error('Failed to start Oil Synth:', error);
            this.showError('Failed to start Oil Synth. Please check your browser compatibility.');
        }
    }
    
    async initializeComponents() {
        // Get optimal settings from performance optimizer
        const audioSettings = performanceOptimizer.getOptimalAudioSettings();
        const visualSettings = performanceOptimizer.getOptimalVisualSettings();
        
        // Initialize synthesizer with optimal settings
        this.synthesizer = new Synthesizer(audioSettings);
        await this.synthesizer.initialize();
        
        // Initialize oil surface visualization with optimal settings
        this.oilSurface = new OilSurface(this.canvas, visualSettings);
        await this.oilSurface.initialize();
        
        // Setup touch handler with callbacks
        this.touchHandler = new TouchHandler(this.canvas, {
            onTouchStart: (id, x, y, intensity) => this.handleTouchStart(id, x, y, intensity),
            onTouchMove: (id, x, y, intensity) => this.handleTouchMove(id, x, y, intensity),
            onTouchEnd: (id, x, y, duration) => this.handleTouchEnd(id, x, y, duration)
        });
        
        this.touchHandler.enable();
    }
    
    setupTouchInteraction() {
        // Touch interactions are handled by the TouchHandler callbacks
        // The oil surface will automatically show visual feedback
    }
    
    setupKnobControls() {
        // Create knob controls with specific parameters for each effect
        const knobOptions = {
            grime: {
                initialValue: this.synthesizer.getParameter('grime'),
                min: 0,
                max: 1,
                step: 0.01
            },
            flow: {
                initialValue: this.synthesizer.getParameter('flow'),
                min: 0,
                max: 1,
                step: 0.01
            },
            shimmer: {
                initialValue: this.synthesizer.getParameter('shimmer'),
                min: 0,
                max: 1,
                step: 0.01
            },
            depth: {
                initialValue: this.synthesizer.getParameter('depth'),
                min: 0,
                max: 1,
                step: 0.01
            },
            octave: {
                initialValue: this.synthesizer.getParameter('octave'),
                min: 0,
                max: 1,
                step: 0.01
            }
        };
        
        this.knobControls = createKnobControls('#controls-panel', knobOptions);
        
        // Connect knobs to synthesizer parameters
        this.knobControls.forEach(knob => {
            knob.onChange((value) => {
                this.synthesizer.setParameter(knob.paramName, value);
                
                // Provide haptic feedback on mobile
                if (navigator.vibrate && value !== knob.options.initialValue) {
                    navigator.vibrate(5);
                }
            });
        });
    }
    
    handleTouchStart(id, x, y, intensity) {
        // Handle first touch
        if (!this.hasStarted) {
            this.hasStarted = true;
            
            // Hide instruction text
            this.instructionText.classList.add('hidden');
            
            // Resume audio context (required for mobile browsers)
            if (this.synthesizer.audioContext.state === 'suspended') {
                this.synthesizer.audioContext.resume();
            }
            
            console.log('First touch - revealing oil surface');
        }
        
        // Convert screen coordinates to normalized coordinates
        const normalizedCoords = this.touchHandler.getNormalizedCoords(x, y);
        
        // Start audio voice
        const voice = this.synthesizer.startVoice(
            normalizedCoords.x, 
            normalizedCoords.y, 
            intensity
        );
        
        if (voice) {
            this.activeVoices.set(id, voice);
        }
        
        // Add visual feedback to oil surface (this triggers reveal on first touch)
        this.oilSurface.addTouch(id, x, y, intensity);
        
        console.log(`Touch start: ${id} at (${x.toFixed(1)}, ${y.toFixed(1)}) intensity: ${intensity.toFixed(2)}`);
    }
    
    handleTouchMove(id, x, y, intensity) {
        const normalizedCoords = this.touchHandler.getNormalizedCoords(x, y);
        
        // Update audio voice position
        const voice = this.activeVoices.get(id);
        if (voice) {
            this.synthesizer.updateVoicePosition(voice, normalizedCoords.x, normalizedCoords.y);
        }
        
        // Update visual feedback
        this.oilSurface.updateTouch(id, x, y, intensity);
    }
    
    handleTouchEnd(id, x, y, duration) {
        // Stop audio voice
        const voice = this.activeVoices.get(id);
        if (voice) {
            this.synthesizer.stopVoice(voice);
            this.activeVoices.delete(id);
        }
        
        // Remove visual feedback
        this.oilSurface.removeTouch(id);
        
        console.log(`Touch end: ${id} duration: ${duration.toFixed(0)}ms`);
    }
    
    handleResize() {
        if (this.oilSurface) {
            this.oilSurface.resize();
        }
    }
    
    showError(message) {
        // Simple error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            max-width: 90%;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    // Performance monitoring
    updatePerformanceStats() {
        const now = performance.now();
        this.frameCount++;
        
        if (now - this.lastFrameTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
            console.log(`FPS: ${fps}, Active Voices: ${this.activeVoices.size}`);
            
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
        
        if (this.isInitialized) {
            requestAnimationFrame(() => this.updatePerformanceStats());
        }
    }
    
    // Cleanup
    destroy() {
        if (this.touchHandler) {
            this.touchHandler.disable();
        }
        
        if (this.synthesizer) {
            this.synthesizer.stopAllVoices();
        }
        
        if (this.oilSurface) {
            this.oilSurface.destroy();
        }
        
        this.knobControls.forEach(knob => knob.destroy());
        
        this.activeVoices.clear();
        this.isInitialized = false;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const oilSynth = new OilSynth();
        await oilSynth.initialize();
        
        // Start performance monitoring
        performanceOptimizer.startFrameMonitoring((fps, frameDelta) => {
            // Log performance in development
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                if (Math.random() < 0.01) { // Log 1% of frames to avoid spam
                    console.log(`FPS: ${fps.toFixed(1)}, Frame: ${frameDelta.toFixed(1)}ms`);
                }
            }
        });
        
        // Initialize battery monitoring for mobile optimization
        await performanceOptimizer.initBatteryMonitoring();
        
        // Listen for performance optimization events
        document.addEventListener('performance-optimize', (event) => {
            const { visualQuality, audioComplexity } = event.detail;
            console.log(`Optimizing: Visual ${(visualQuality * 100).toFixed(0)}%, Audio ${(audioComplexity * 100).toFixed(0)}%`);
            
            if (oilSynth.oilSurface) {
                oilSynth.oilSurface.setQuality(visualQuality);
            }
            
            if (oilSynth.synthesizer) {
                oilSynth.synthesizer.setComplexity(audioComplexity);
            }
        });
        
        // Make available globally for debugging
        window.oilSynth = oilSynth;
        
    } catch (error) {
        console.error('Failed to initialize Oil Synth:', error);
    }
});

// Handle page visibility changes to pause/resume
document.addEventListener('visibilitychange', () => {
    if (window.oilSynth && window.oilSynth.synthesizer) {
        if (document.hidden) {
            // Page hidden - stop all voices to save battery
            window.oilSynth.synthesizer.stopAllVoices();
            if (window.oilSynth.touchHandler) {
                window.oilSynth.touchHandler.clearTouches();
            }
        } else {
            // Page visible - resume audio context if suspended
            if (window.oilSynth.synthesizer.audioContext.state === 'suspended') {
                window.oilSynth.synthesizer.audioContext.resume();
            }
        }
    }
});

// Handle beforeunload to cleanup
window.addEventListener('beforeunload', () => {
    if (window.oilSynth) {
        window.oilSynth.destroy();
    }
});