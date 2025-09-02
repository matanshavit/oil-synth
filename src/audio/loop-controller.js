export class LoopController {
    constructor(synthesizer) {
        this.synthesizer = synthesizer;
        this.audioContext = synthesizer.audioContext;
        
        // Loop state
        this.isRecording = false;
        this.isPlaying = false;
        this.recordedBuffer = null;
        this.loopDuration = 0;
        this.recordStartTime = 0;
        this.playStartTime = 0;
        this.playbackSource = null;
        
        // Recording setup
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingGain = null;
        this.outputGain = null;
        this.volume = 0.8;
        
        // Performance optimization
        this.maxLoopDuration = 30; // 30 second max loop
        this.bufferSize = 4096; // Optimize for low latency
        
        this.isInitialized = false;
    }
    
    async initialize() {
        if (this.isInitialized || !this.synthesizer.isInitialized) return;
        
        try {
            await this.setupAudioChain();
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize loop controller:', error);
        }
    }
    
    async setupAudioChain() {
        // Create gains for recording and output mixing
        this.recordingGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();
        
        // Set initial volume
        this.outputGain.gain.value = this.volume;
        
        // Connect output gain to destination for playback
        this.outputGain.connect(this.audioContext.destination);
        
        // For recording, we'll tap into the synthesizer's master output
        this.synthesizer.masterGain.connect(this.recordingGain);
    }
    
    async startRecording() {
        if (!this.isInitialized) {
            console.error('Loop controller not initialized');
            return false;
        }
        
        try {
            // If already playing, this is overdub mode
            const isOverdub = this.isPlaying;
            
            if (isOverdub) {
                await this.startOverdubRecording();
            } else {
                await this.startNewRecording();
            }
            
            this.isRecording = true;
            this.recordStartTime = this.audioContext.currentTime;
            
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }
    
    async startNewRecording() {
        // Create a destination for recording
        this.recordDestination = this.audioContext.createMediaStreamDestination();
        this.recordingGain.connect(this.recordDestination);
        
        // Set up MediaRecorder for capturing audio
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.recordDestination.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = async () => {
            await this.processRecording();
        };
        
        this.mediaRecorder.start(100); // Collect data every 100ms for responsiveness
    }
    
    async startOverdubRecording() {
        // For overdub, record ONLY the new live input (not the existing playback)
        // This prevents feedback loops and compounding
        this.overdubDestination = this.audioContext.createMediaStreamDestination();
        
        // Connect ONLY the live input to the recording destination
        this.recordingGain.connect(this.overdubDestination);
        
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.overdubDestination.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = async () => {
            await this.processOverdubRecording();
        };
        
        // Store the overdub start time for final processing
        this.overdubStartTime = this.audioContext.currentTime;
        
        this.mediaRecorder.start(); // Simple recording without real-time chunks
    }
    
    stopRecording() {
        if (!this.isRecording) return false;
        
        this.isRecording = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        // Only calculate loop duration for new recordings, not overdubs
        if (!this.recordedBuffer) {
            // Calculate loop duration for initial recording
            this.loopDuration = this.audioContext.currentTime - this.recordStartTime;
            
            // Ensure minimum loop duration for stability
            if (this.loopDuration < 0.1) {
                this.loopDuration = 0.1;
            }
            
            // Cap at maximum duration
            if (this.loopDuration > this.maxLoopDuration) {
                this.loopDuration = this.maxLoopDuration;
            }
        }
        
        return true;
    }
    
    async processRecording() {
        if (this.recordedChunks.length === 0) return;
        
        try {
            // Convert recorded chunks to audio buffer
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
            const arrayBuffer = await blob.arrayBuffer();
            this.recordedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Start playing immediately after recording
            this.startPlayback();
        } catch (error) {
            console.error('Error processing recording:', error);
        }
    }
    
    async processOverdubRecording() {
        if (this.recordedChunks.length === 0) return;
        
        try {
            // Calculate current playback position before stopping
            const currentPosition = this.getPlaybackPosition();
            
            // Stop current playback
            this.stopPlayback();
            
            // Store the original loop buffer before processing
            const originalBuffer = this.recordedBuffer;
            
            // Convert new overdub recording to buffer
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
            const arrayBuffer = await blob.arrayBuffer();
            const overdubBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create a new buffer with the same duration as the original loop
            const targetSamples = Math.floor(this.loopDuration * this.audioContext.sampleRate);
            const mixedBuffer = this.audioContext.createBuffer(
                Math.max(originalBuffer.numberOfChannels, overdubBuffer.numberOfChannels),
                targetSamples,
                this.audioContext.sampleRate
            );
            
            // Calculate where the overdub started in the loop cycle
            const overdubStartInLoop = (this.overdubStartTime - this.playStartTime) % this.loopDuration;
            const overdubStartSample = Math.floor(overdubStartInLoop * this.audioContext.sampleRate);
            
            // Mix the original buffer with the new overdub
            for (let channel = 0; channel < mixedBuffer.numberOfChannels; channel++) {
                const mixedData = mixedBuffer.getChannelData(channel);
                
                // First, copy the entire original loop
                if (channel < originalBuffer.numberOfChannels) {
                    const originalData = originalBuffer.getChannelData(channel);
                    for (let i = 0; i < Math.min(originalData.length, targetSamples); i++) {
                        mixedData[i] = originalData[i];
                    }
                }
                
                // Then, add the overdub data with wrapping for multiple loop cycles
                if (channel < overdubBuffer.numberOfChannels) {
                    const overdubData = overdubBuffer.getChannelData(channel);
                    
                    // Layer the overdub data, wrapping around the loop as many times as needed
                    for (let i = 0; i < overdubData.length; i++) {
                        const targetIndex = (overdubStartSample + i) % targetSamples;
                        
                        // ADDITIVE mixing: add the new overdub to what's already there
                        // This creates proper layering without replacing existing content
                        const overdubSample = overdubData[i] * 0.6; // Reduce volume to prevent clipping
                        mixedData[targetIndex] = Math.max(-1, Math.min(1, mixedData[targetIndex] + overdubSample));
                    }
                }
            }
            
            // Replace the buffer with the mixed result
            this.recordedBuffer = mixedBuffer;
            
            // Resume playback from the current position instead of restarting
            this.startPlaybackAtPosition(currentPosition);
        } catch (error) {
            console.error('Error processing overdub:', error);
        }
    }
    
    startPlayback() {
        return this.startPlaybackAtPosition(0);
    }
    
    startPlaybackAtPosition(position = 0) {
        if (!this.recordedBuffer || this.isPlaying) return false;
        
        try {
            this.playbackSource = this.audioContext.createBufferSource();
            this.playbackSource.buffer = this.recordedBuffer;
            this.playbackSource.loop = true;
            this.playbackSource.loopStart = 0;
            this.playbackSource.loopEnd = this.loopDuration;
            
            // Connect through output gain for volume control
            this.playbackSource.connect(this.outputGain);
            
            // Calculate the offset time to start at the desired position
            const startOffset = position * this.loopDuration;
            
            // Start playback with offset
            this.playbackSource.start(0, startOffset);
            this.isPlaying = true;
            
            // Adjust playStartTime to account for the offset
            this.playStartTime = this.audioContext.currentTime - startOffset;
            
            return true;
        } catch (error) {
            console.error('Error starting playback:', error);
            return false;
        }
    }
    
    stopPlayback() {
        if (!this.isPlaying || !this.playbackSource) return false;
        
        try {
            this.playbackSource.stop();
            this.playbackSource = null;
            this.isPlaying = false;
            
            return true;
        } catch (error) {
            console.error('Error stopping playback:', error);
            return false;
        }
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            return this.stopPlayback();
        } else if (this.recordedBuffer) {
            return this.startPlayback();
        }
        return false;
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.outputGain) {
            this.outputGain.gain.setTargetAtTime(
                this.volume, 
                this.audioContext.currentTime, 
                0.05
            );
        }
    }
    
    clear() {
        // Stop recording and playback
        if (this.isRecording) {
            this.stopRecording();
        }
        if (this.isPlaying) {
            this.stopPlayback();
        }
        
        // Clear buffers and reset state
        this.recordedBuffer = null;
        this.loopDuration = 0;
        this.recordedChunks = [];
        
        // Clean up media recorder
        if (this.mediaRecorder) {
            try {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            } catch (error) {
                // MediaRecorder might already be stopped
            }
            this.mediaRecorder = null;
        }
        
        // Clean up overdub processing
        
        // Disconnect recording destinations
        if (this.recordDestination) {
            this.recordingGain.disconnect(this.recordDestination);
            this.recordDestination = null;
        }
        
        if (this.overdubDestination) {
            this.recordingGain.disconnect(this.overdubDestination);
            this.overdubDestination = null;
        }
        
        return true;
    }
    
    // Get current state for UI updates
    getState() {
        return {
            isRecording: this.isRecording,
            isPlaying: this.isPlaying,
            hasLoop: !!this.recordedBuffer,
            duration: this.loopDuration,
            volume: this.volume
        };
    }
    
    // Get current playback position for visual feedback
    getPlaybackPosition() {
        if (!this.isPlaying || this.loopDuration === 0) return 0;
        
        const elapsed = (this.audioContext.currentTime - this.playStartTime) % this.loopDuration;
        return elapsed / this.loopDuration; // Returns 0-1
    }
}