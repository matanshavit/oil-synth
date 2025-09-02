export class OilSurface {
    constructor(canvas, settings = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        this.isInitialized = false;
        
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }
        
        // Shader programs
        this.fluidProgram = null;
        this.renderProgram = null;
        
        // Framebuffers for double buffering
        this.velocityFBO = null;
        this.pressureFBO = null;
        this.currentTexture = null;
        this.previousTexture = null;
        
        // Uniforms and attributes
        this.uniforms = {};
        
        // Touch points
        this.touches = new Map();
        this.touchHistory = [];
        
        // Quality settings
        this.quality = settings.shaderComplexity || 1.0;
        
        // Reveal state
        this.isRevealed = false;
        this.revealCenter = { x: 0.5, y: 0.5 }; // Single reveal center
        this.revealStartTime = 0;
        this.revealDuration = 4.0; // seconds for reveal to complete
        
        // Animation
        this.time = 0;
        this.animationId = null;
        
        // Colors for oil effect
        this.colors = [
            [0.8, 0.2, 0.8], // Magenta
            [0.2, 0.8, 0.8], // Cyan
            [0.8, 0.8, 0.2], // Yellow
            [0.8, 0.4, 0.2], // Orange
            [0.4, 0.8, 0.2], // Green
            [0.2, 0.4, 0.8]  // Blue
        ];
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.resizeCanvas();
            await this.createShaders();
            this.createFramebuffers();
            this.setupGeometry();
            this.isInitialized = true;
            this.startAnimation();
        } catch (error) {
            console.error('Failed to initialize oil surface:', error);
        }
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    async createShaders() {
        // Vertex shader (same for both programs)
        const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            
            void main() {
                v_texCoord = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        
        // Fragment shader for oil surface rendering
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec2 v_texCoord;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_touches[10];
            uniform int u_touchCount;
            uniform float u_touchIntensity[10];
            uniform vec2 u_revealCenter;
            uniform float u_revealProgress;
            
            // Noise function
            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = noise(i);
                float b = noise(i + vec2(1.0, 0.0));
                float c = noise(i + vec2(0.0, 1.0));
                float d = noise(i + vec2(1.0, 1.0));
                
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            
            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 2.0;
                
                for(int i = 0; i < 4; i++) {
                    value += amplitude * smoothNoise(p * frequency);
                    amplitude *= 0.5;
                    frequency *= 2.0;
                }
                
                return value;
            }
            
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }
            
            void main() {
                vec2 uv = v_texCoord;
                vec2 p = uv * 4.0;
                
                // More organic, slower fluid motion like oil
                float fluid = fbm(p + u_time * 0.12); // Slower primary movement
                fluid += fbm(p * 1.8 - u_time * 0.08) * 0.6; // Gentler secondary layer
                fluid += fbm(p * 3.5 + u_time * 0.05) * 0.3; // Subtle detail layer
                
                // Touch influence
                float touchInfluence = 0.0;
                vec2 touchCenter = vec2(0.5);
                
                for(int i = 0; i < 10; i++) {
                    if(i >= u_touchCount) break;
                    
                    vec2 touchPos = u_touches[i];
                    float dist = distance(uv, touchPos);
                    float intensity = u_touchIntensity[i];
                    
                    // Create ripples
                    float ripple = sin(dist * 20.0 - u_time * 8.0) * 0.5 + 0.5;
                    ripple *= exp(-dist * 3.0) * intensity;
                    
                    touchInfluence += ripple;
                    
                    // Blend touch centers for color
                    touchCenter = mix(touchCenter, touchPos, intensity * 0.3);
                }
                
                // Combine fluid and touch
                fluid += touchInfluence;
                
                // Create softer, oil-like colors
                float hue = fract(fluid * 0.2 + touchCenter.x * 0.3 + touchCenter.y * 0.2 + u_time * 0.03);
                float sat = 0.35 + 0.25 * sin(fluid * 1.5); // Much lower saturation
                float val = 0.4 + 0.35 * fluid; // Slightly darker overall
                
                // Add subtle oil-like shimmer
                float shimmer = pow(max(0.0, sin(fluid * 6.0 + u_time * 1.5)), 2.0);
                val += shimmer * 0.15; // More subtle shimmer
                
                vec3 oilColor = hsv2rgb(vec3(hue, sat, val));
                
                // Add depth with more organic gradients
                float depth = smoothstep(0.15, 0.85, fluid);
                oilColor *= 0.3 + 0.6 * depth; // Deeper, richer shadows
                
                // Stay pure black until first touch
                if (u_revealProgress <= 0.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    return;
                }
                
                // Single reveal center expanding outward
                float distToReveal = distance(uv, u_revealCenter);
                
                // Create organic oil bubble shape using multiple noise layers
                float noiseValue = fbm(uv * 6.0 + u_time * 0.08) * 0.4;
                noiseValue += fbm(uv * 12.0 - u_time * 0.05) * 0.2; // Additional detail
                float revealRadius = u_revealProgress * 1.3 + noiseValue;
                
                // Much softer, more organic edges like oil spreading
                float revealMask = 1.0 - smoothstep(revealRadius - 0.25, revealRadius + 0.15, distToReveal);
                
                // Mix between black and oil colors based on reveal
                vec3 finalColor = mix(vec3(0.0), oilColor, revealMask);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
        
        // Create and compile shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Create shader program
        this.renderProgram = this.createProgram(vertexShader, fragmentShader);
        
        // Get uniform locations
        this.uniforms = {
            time: this.gl.getUniformLocation(this.renderProgram, 'u_time'),
            resolution: this.gl.getUniformLocation(this.renderProgram, 'u_resolution'),
            touches: this.gl.getUniformLocation(this.renderProgram, 'u_touches'),
            touchCount: this.gl.getUniformLocation(this.renderProgram, 'u_touchCount'),
            touchIntensity: this.gl.getUniformLocation(this.renderProgram, 'u_touchIntensity'),
            revealCenter: this.gl.getUniformLocation(this.renderProgram, 'u_revealCenter'),
            revealProgress: this.gl.getUniformLocation(this.renderProgram, 'u_revealProgress')
        };
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    setupGeometry() {
        // Create full-screen quad
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        
        const positionLocation = this.gl.getAttribLocation(this.renderProgram, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
    
    createFramebuffers() {
        // For now, we'll render directly to screen
        // In a more complex implementation, we'd use framebuffers for fluid simulation
    }
    
    addTouch(id, x, y, intensity = 1.0) {
        const rect = this.canvas.getBoundingClientRect();
        const normalizedX = x / rect.width;
        const normalizedY = 1.0 - (y / rect.height); // Flip Y coordinate
        
        // Start reveal on first touch only
        if (!this.isRevealed) {
            this.startReveal(normalizedX, normalizedY);
        }
        
        this.touches.set(id, {
            x: normalizedX,
            y: normalizedY,
            intensity: intensity,
            startTime: this.time
        });
        
        // Add to history for ripple effects
        this.touchHistory.push({
            x: normalizedX,
            y: normalizedY,
            time: this.time,
            intensity: intensity
        });
        
        // Limit history size
        if (this.touchHistory.length > 50) {
            this.touchHistory.shift();
        }
    }
    
    startReveal(x, y) {
        this.isRevealed = true;
        this.revealCenter = { x, y };
        this.revealStartTime = this.time;
    }
    
    updateTouch(id, x, y, intensity = 1.0) {
        if (this.touches.has(id)) {
            const rect = this.canvas.getBoundingClientRect();
            const normalizedX = x / rect.width;
            const normalizedY = 1.0 - (y / rect.height);
            
            const touch = this.touches.get(id);
            const oldX = touch.x;
            const oldY = touch.y;
            
            touch.x = normalizedX;
            touch.y = normalizedY;
            touch.intensity = intensity;
            
            // No additional logic needed - single reveal only
        }
    }
    
    removeTouch(id) {
        this.touches.delete(id);
    }
    
    startAnimation() {
        const animate = (timestamp) => {
            this.time = timestamp * 0.001; // Convert to seconds
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate(0);
    }
    
    render() {
        if (!this.isInitialized) return;
        
        this.gl.useProgram(this.renderProgram);
        
        // Update uniforms
        this.gl.uniform1f(this.uniforms.time, this.time);
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        
        // Update reveal data
        if (this.isRevealed) {
            const revealProgress = Math.min(1.0, (this.time - this.revealStartTime) / this.revealDuration);
            this.gl.uniform1f(this.uniforms.revealProgress, revealProgress);
            this.gl.uniform2f(this.uniforms.revealCenter, this.revealCenter.x, this.revealCenter.y);
        } else {
            this.gl.uniform1f(this.uniforms.revealProgress, 0.0);
        }
        
        // Update touch data
        const touchArray = Array.from(this.touches.values());
        const maxTouches = Math.min(touchArray.length, 10);
        
        if (maxTouches > 0) {
            const positions = new Float32Array(maxTouches * 2);
            const intensities = new Float32Array(maxTouches);
            
            for (let i = 0; i < maxTouches; i++) {
                positions[i * 2] = touchArray[i].x;
                positions[i * 2 + 1] = touchArray[i].y;
                intensities[i] = touchArray[i].intensity;
            }
            
            this.gl.uniform2fv(this.uniforms.touches, positions);
            this.gl.uniform1fv(this.uniforms.touchIntensity, intensities);
        }
        
        this.gl.uniform1i(this.uniforms.touchCount, maxTouches);
        
        // Clear and draw
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    resize() {
        this.resizeCanvas();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.touches.clear();
        this.touchHistory = [];
    }
    
    // Performance optimization method
    setQuality(quality) {
        this.quality = Math.max(0.1, Math.min(1.0, quality));
    }
}