export class Synthesizer {
    constructor(settings = {}) {
        this.audioContext = null;
        this.masterGain = null;
        this.voices = [];
        this.maxVoices = settings.maxVoices || 5;
        this.isInitialized = false;
        this.settings = settings; // Store settings for later use
        
        // Effect nodes
        this.distortion = null;
        this.delay = null;
        this.chorus = null;
        this.reverb = null;
        
        // Parameters
        this.params = {
            grime: 0.3,    // distortion amount
            flow: 0.2,     // delay time and feedback
            shimmer: 0.15, // chorus depth
            depth: 0.25,   // reverb amount
            octave: 0.45   // octave range (0.0 = very low, 1.0 = high)
        };
        
        // Pentatonic scale intervals (C major pentatonic)
        this.pentatonicIntervals = [0, 2, 4, 7, 9]; // C, D, E, G, A
        this.baseFreq = 261.63; // C4
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.setupAudioChain();
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize synthesizer:', error);
        }
    }
    
    async setupAudioChain() {
        // Master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3;
        
        // Distortion (waveshaper with wet/dry mix)
        this.distortion = this.audioContext.createWaveShaper();
        this.distortion.curve = this.makeDistortionCurve(50);
        this.distortion.oversample = '4x';
        
        // Distortion wet/dry mix
        this.distortionWet = this.audioContext.createGain();
        this.distortionDry = this.audioContext.createGain();
        this.distortionOutput = this.audioContext.createGain();
        
        this.distortionWet.gain.value = 0.3; // Start with some distortion
        this.distortionDry.gain.value = 0.7; // And some clean signal
        
        // Delay
        this.delay = this.audioContext.createDelay(1.0);
        this.delayGain = this.audioContext.createGain();
        this.delayFeedback = this.audioContext.createGain();
        this.delay.delayTime.value = this.settings.bufferSize ? this.settings.bufferSize / 1000 : 0.2;
        this.delayGain.gain.value = 0.3;
        this.delayFeedback.gain.value = 0.4;
        
        // Chorus (using delay + LFO)
        this.chorusDelay = this.audioContext.createDelay(0.03);
        this.chorusLFO = this.audioContext.createOscillator();
        this.chorusGain = this.audioContext.createGain();
        this.chorusDepth = this.audioContext.createGain();
        
        this.chorusLFO.frequency.value = 0.5;
        this.chorusDepth.gain.value = 0.005;
        this.chorusGain.gain.value = 0.5;
        this.chorusDelay.delayTime.value = 0.015;
        
        // Reverb (convolution reverb with synthetic impulse)
        this.reverb = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = 0.2;
        
        await this.createReverbImpulse();
        
        // Connect chorus LFO
        this.chorusLFO.connect(this.chorusDepth);
        this.chorusDepth.connect(this.chorusDelay.delayTime);
        this.chorusLFO.start();
        
        // Connect delay feedback loop
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        
        // Connect distortion wet/dry mix
        this.distortion.connect(this.distortionWet);
        this.distortionWet.connect(this.distortionOutput);
        this.distortionDry.connect(this.distortionOutput);
        
        // Main audio chain: distortionOutput -> delay -> chorus -> reverb -> master
        this.distortionOutput.connect(this.delay);
        this.distortionOutput.connect(this.chorusDelay);
        
        this.delay.connect(this.delayGain);
        this.chorusDelay.connect(this.chorusGain);
        
        this.delayGain.connect(this.reverb);
        this.chorusGain.connect(this.reverb);
        this.distortionOutput.connect(this.reverb); // dry signal
        
        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
        this.distortionOutput.connect(this.masterGain); // dry path
        
        this.masterGain.connect(this.audioContext.destination);
    }
    
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        
        return curve;
    }
    
    async createReverbImpulse() {
        const length = this.audioContext.sampleRate * 2; // 2 seconds
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        
        this.reverb.buffer = impulse;
    }
    
    // Convert normalized position (0-1) to pentatonic frequency
    positionToFrequency(x, y) {
        // Quantize octave parameter to discrete, musically pleasing steps
        // This prevents dissonant intermediate tunings
        const octaveSteps = [0.0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0]; // 7 discrete positions
        const octaveRanges = [-2, -1, -0.5, 0, 0.5, 1, 2]; // Corresponding octave offsets
        
        // Find closest octave step
        let closestIndex = 0;
        let minDistance = Math.abs(this.params.octave - octaveSteps[0]);
        
        for (let i = 1; i < octaveSteps.length; i++) {
            const distance = Math.abs(this.params.octave - octaveSteps[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }
        
        const octaveOffset = octaveRanges[closestIndex];
        const baseOctave = 2 + octaveOffset; // Center around octave 2
        const octave = Math.floor(y * 2) + baseOctave; // 2-octave range from base
        
        const scaleIndex = Math.floor(x * this.pentatonicIntervals.length);
        
        // Calculate semitones relative to C0 (not C4)
        const semitonesFromC0 = this.pentatonicIntervals[scaleIndex] + (octave * 12);
        
        // C0 frequency is ~16.35 Hz
        const c0Freq = 16.35;
        return c0Freq * Math.pow(2, semitonesFromC0 / 12);
    }
    
    // Start a voice at position with given intensity
    startVoice(x, y, intensity = 1.0) {
        if (!this.isInitialized) {
            console.error('❌ Synthesizer not initialized');
            return null;
        }
        
        // Resume audio context if suspended (mobile requirement)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Find available voice slot
        let voiceIndex = this.voices.findIndex(voice => !voice || !voice.playing);
        if (voiceIndex === -1) {
            if (this.voices.length < this.maxVoices) {
                voiceIndex = this.voices.length;
            } else {
                // Steal oldest voice
                voiceIndex = 0;
                this.stopVoice(this.voices[0]);
            }
        }
        
        const frequency = this.positionToFrequency(x, y);
        const voice = this.createVoice(frequency, intensity, x, y);
        this.voices[voiceIndex] = voice;
        
        return voice;
    }
    
    createVoice(frequency, intensity, x, y) {
        const now = this.audioContext.currentTime;
        
        // Oscillators for rich sound
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const subOsc = this.audioContext.createOscillator();
        
        // Gains
        const osc1Gain = this.audioContext.createGain();
        const osc2Gain = this.audioContext.createGain();
        const subGain = this.audioContext.createGain();
        const voiceGain = this.audioContext.createGain();
        const envelope = this.audioContext.createGain();
        
        // Filter for brightness control
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800 + (y * 4000); // Y controls brightness
        filter.Q.value = 1 + (y * 3); // More resonance higher up
        
        // Oscillator setup
        osc1.type = 'sawtooth';
        osc1.frequency.value = frequency;
        
        osc2.type = 'square';
        osc2.frequency.value = frequency * 1.01; // Slight detune
        
        subOsc.type = 'sine';
        subOsc.frequency.value = frequency * 0.5; // Sub octave
        
        // Gain levels
        osc1Gain.gain.value = 0.4;
        osc2Gain.gain.value = 0.3;
        subGain.gain.value = 0.3;
        voiceGain.gain.value = intensity * 0.8;
        
        // ADSR envelope
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(1, now + 0.01); // Quick attack
        envelope.gain.exponentialRampToValueAtTime(0.7, now + 0.1); // Decay
        
        // Connect oscillators
        osc1.connect(osc1Gain);
        osc2.connect(osc2Gain);
        subOsc.connect(subGain);
        
        osc1Gain.connect(filter);
        osc2Gain.connect(filter);
        subGain.connect(filter);
        
        filter.connect(envelope);
        envelope.connect(voiceGain);
        
        // Connect to both distortion and dry path
        voiceGain.connect(this.distortion);
        voiceGain.connect(this.distortionDry);
        
        // Start oscillators
        osc1.start(now);
        osc2.start(now);
        subOsc.start(now);
        
        return {
            oscillators: [osc1, osc2, subOsc],
            gains: [osc1Gain, osc2Gain, subGain],
            voiceGain,
            envelope,
            filter,
            playing: true,
            frequency,
            x,
            y,
            startTime: now
        };
    }
    
    stopVoice(voice) {
        if (!voice || !voice.playing) return;
        
        const now = this.audioContext.currentTime;
        voice.playing = false;
        
        // Release envelope
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
        voice.envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        // Stop oscillators
        setTimeout(() => {
            voice.oscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {
                    // Oscillator might already be stopped
                }
            });
        }, 250);
    }
    
    updateVoicePosition(voice, x, y) {
        if (!voice || !voice.playing) return;
        
        const frequency = this.positionToFrequency(x, y);
        voice.oscillators.forEach(osc => {
            osc.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.01);
        });
        
        // Update filter brightness
        voice.filter.frequency.setTargetAtTime(
            800 + (y * 4000), 
            this.audioContext.currentTime, 
            0.01
        );
        
        voice.x = x;
        voice.y = y;
        voice.frequency = frequency;
    }
    
    setParameter(param, value) {
        this.params[param] = Math.max(0, Math.min(1, value));
        const percentage = (value * 100).toFixed(0);
        
        switch (param) {
            case 'grime':
                if (this.distortion && this.distortionWet && this.distortionDry) {
                    // More aggressive distortion curve
                    this.distortion.curve = this.makeDistortionCurve(20 + value * 200);
                    
                    // Wet/dry mix: 0 = clean, 1 = fully distorted
                    this.distortionWet.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.05);
                    this.distortionDry.gain.setTargetAtTime(1 - value, this.audioContext.currentTime, 0.05);
                    
                    this.logParameter('🔥 GRIME', percentage, `curve: ${(20 + value * 200).toFixed(0)}`);
                }
                break;
                
            case 'flow':
                if (this.delay && this.delayGain && this.delayFeedback) {
                    // More dramatic delay settings
                    const delayTime = 0.05 + value * 0.45; // 50ms to 500ms
                    const delayLevel = value * 0.8; // Up to 80% wet
                    const feedback = value * 0.85; // Up to 85% feedback for more repeats
                    
                    this.delay.delayTime.setTargetAtTime(delayTime, this.audioContext.currentTime, 0.05);
                    this.delayGain.gain.setTargetAtTime(delayLevel, this.audioContext.currentTime, 0.05);
                    this.delayFeedback.gain.setTargetAtTime(feedback, this.audioContext.currentTime, 0.05);
                    
                    this.logParameter('💧 FLOW', percentage, `delay: ${(delayTime * 1000).toFixed(0)}ms, level: ${(delayLevel * 100).toFixed(0)}%, feedback: ${(feedback * 100).toFixed(0)}%`);
                }
                break;
                
            case 'shimmer':
                if (this.chorusGain && this.chorusDepth) {
                    const chorusLevel = value * 0.8;
                    const chorusDepth = value * 0.01;
                    
                    this.chorusGain.gain.setTargetAtTime(chorusLevel, this.audioContext.currentTime, 0.1);
                    this.chorusDepth.gain.setTargetAtTime(chorusDepth, this.audioContext.currentTime, 0.1);
                    
                    this.logParameter('✨ SHIMMER', percentage, `level: ${(chorusLevel * 100).toFixed(0)}%, depth: ${(chorusDepth * 1000).toFixed(1)}ms`);
                }
                break;
                
            case 'depth':
                if (this.reverbGain) {
                    const reverbLevel = value * 0.5;
                    this.reverbGain.gain.setTargetAtTime(reverbLevel, this.audioContext.currentTime, 0.1);
                    
                    this.logParameter('🌊 DEPTH', percentage, `reverb level: ${(reverbLevel * 100).toFixed(0)}%`);
                }
                break;
                
            case 'octave':
                // Find the quantized octave range for logging
                const octaveSteps = [0.0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0];
                const octaveRanges = [-2, -1, -0.5, 0, 0.5, 1, 2];
                const stepNames = ['Very Low', 'Low', 'Mid-Low', 'Mid', 'Mid-High', 'High', 'Very High'];
                
                let closestIndex = 0;
                let minDistance = Math.abs(value - octaveSteps[0]);
                
                for (let i = 1; i < octaveSteps.length; i++) {
                    const distance = Math.abs(value - octaveSteps[i]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = i;
                    }
                }
                
                const quantizedOffset = octaveRanges[closestIndex];
                const baseOctave = 2 + quantizedOffset;
                const range = `${baseOctave.toFixed(1)}-${(baseOctave + 2).toFixed(1)}`;
                const stepName = stepNames[closestIndex];
                
                this.logParameter('🎹 OCTAVE', percentage, `${stepName} (${range})`);
                break;
        }
    }
    
    logParameter(name, percentage, details) {
    }
    
    getParameter(param) {
        return this.params[param];
    }
    
    stopAllVoices() {
        this.voices.forEach(voice => this.stopVoice(voice));
        this.voices = [];
    }
    
    // Performance optimization method
    setComplexity(complexity) {
        const oldMaxVoices = this.maxVoices;
        this.maxVoices = Math.ceil(5 * complexity);
        
        // Stop excess voices if reducing complexity
        if (this.maxVoices < oldMaxVoices) {
            const excessVoices = this.voices.slice(this.maxVoices);
            excessVoices.forEach(voice => this.stopVoice(voice));
        }
        
    }
}