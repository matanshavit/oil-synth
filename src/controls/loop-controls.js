export class LoopControls {
    constructor(loopController) {
        this.loopController = loopController;
        
        // DOM elements
        this.recordBtn = document.getElementById('loop-record');
        this.playBtn = document.getElementById('loop-play');
        this.volumeKnob = document.getElementById('loop-volume');
        this.clearBtn = document.getElementById('loop-clear');
        this.progressIndicator = document.querySelector('.loop-progress-indicator');
        this.progressBar = this.progressIndicator.querySelector('.progress-bar');
        
        // Volume knob interaction
        this.isDraggingVolume = false;
        this.volumeStartY = 0;
        this.volumeStartValue = 0;
        this.volumeRotation = 0; // -135 to +135 degrees
        
        // State
        this.isInitialized = false;
        
        // Animation
        this.animationId = null;
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.setupEventListeners();
            this.updateUI();
            this.startAnimation();
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize loop controls:', error);
        }
    }
    
    setupEventListeners() {
        // Record button
        this.recordBtn.addEventListener('click', () => this.handleRecord());
        this.recordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleRecord();
        });
        
        // Play/pause button
        this.playBtn.addEventListener('click', () => this.handlePlayPause());
        this.playBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePlayPause();
        });
        
        // Clear button
        this.clearBtn.addEventListener('click', () => this.handleClear());
        this.clearBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleClear();
        });
        
        // Volume knob - mouse events
        this.volumeKnob.addEventListener('mousedown', (e) => this.startVolumeInteraction(e));
        document.addEventListener('mousemove', (e) => this.handleVolumeMove(e));
        document.addEventListener('mouseup', () => this.endVolumeInteraction());
        
        // Volume knob - touch events
        this.volumeKnob.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startVolumeInteraction(e.touches[0]);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (this.isDraggingVolume) {
                e.preventDefault();
                this.handleVolumeMove(e.touches[0]);
            }
        }, { passive: false });
        
        document.addEventListener('touchend', () => this.endVolumeInteraction());
    }
    
    async handleRecord() {
        const state = this.loopController.getState();
        
        if (state.isRecording) {
            // Stop recording
            this.loopController.stopRecording();
        } else {
            // Start recording
            await this.loopController.startRecording();
        }
        
        this.updateUI();
    }
    
    handlePlayPause() {
        const state = this.loopController.getState();
        
        if (!state.hasLoop) {
            return;
        }
        
        this.loopController.togglePlayback();
        this.updateUI();
    }
    
    handleClear() {
        this.loopController.clear();
        this.updateUI();
    }
    
    startVolumeInteraction(event) {
        this.isDraggingVolume = true;
        this.volumeStartY = event.clientY;
        this.volumeStartValue = this.loopController.volume;
        
        // Add active class for visual feedback
        this.volumeKnob.classList.add('active');
    }
    
    handleVolumeMove(event) {
        if (!this.isDraggingVolume) return;
        
        const deltaY = this.volumeStartY - event.clientY;
        const sensitivity = 0.005;
        const newValue = Math.max(0, Math.min(1, this.volumeStartValue + deltaY * sensitivity));
        
        this.loopController.setVolume(newValue);
        this.updateVolumeKnob(newValue);
    }
    
    endVolumeInteraction() {
        this.isDraggingVolume = false;
        this.volumeKnob.classList.remove('active');
    }
    
    updateVolumeKnob(volume) {
        // Convert volume (0-1) to rotation (-135 to +135 degrees)
        this.volumeRotation = (volume - 0.5) * 270;
        const handle = this.volumeKnob.querySelector('.knob-handle');
        if (handle) {
            handle.style.transform = `translateX(-50%) rotate(${this.volumeRotation}deg)`;
        }
    }
    
    updateUI() {
        const state = this.loopController.getState();
        
        // Update record button
        this.recordBtn.setAttribute('data-state', state.isRecording ? 'recording' : 'idle');
        
        // Update play button
        this.playBtn.setAttribute('data-state', state.isPlaying ? 'playing' : 'stopped');
        
        // Update progress circle
        if (state.isPlaying && state.hasLoop) {
            const position = this.loopController.getPlaybackPosition();
            this.updateProgressCircle(position);
        }
        
        // Update button availability
        this.playBtn.disabled = !state.hasLoop;
        this.playBtn.style.opacity = state.hasLoop ? '1' : '0.5';
        
        this.clearBtn.disabled = !state.hasLoop;
        this.clearBtn.style.opacity = state.hasLoop ? '1' : '0.5';
        
        // Update volume knob
        this.updateVolumeKnob(state.volume);
    }
    
    updateProgressCircle(position) {
        if (!this.progressBar) return;
        
        // Normalize position to ensure it's between 0 and 1
        const normalizedPosition = position % 1;
        
        // Calculate stroke-dashoffset based on position (0-1)
        // Full circle circumference is ~113.10 (2 * π * r where r=18)
        const circumference = 113.10;
        const offset = circumference - (normalizedPosition * circumference);
        
        this.progressBar.style.strokeDashoffset = offset.toString();
    }
    
    startAnimation() {
        const animate = () => {
            this.updateUI();
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove event listeners
        this.recordBtn.removeEventListener('click', () => this.handleRecord());
        this.playBtn.removeEventListener('click', () => this.handlePlayPause());
        this.clearBtn.removeEventListener('click', () => this.handleClear());
        
        // Remove volume knob listeners
        this.volumeKnob.removeEventListener('mousedown', () => this.startVolumeInteraction());
        document.removeEventListener('mousemove', () => this.handleVolumeMove());
        document.removeEventListener('mouseup', () => this.endVolumeInteraction());
        
        this.isInitialized = false;
    }
}