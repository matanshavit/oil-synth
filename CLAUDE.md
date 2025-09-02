# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oil Synth is a mobile-optimized audio synthesizer with a fluid, oil-like visual interface. The primary focus is **responsiveness** - audio must play immediately upon user input with minimal latency.

### Core Requirements
- Mobile-first design with touch-optimized controls
- Visual interface inspired by spilled oil with smooth color transitions
- Grimey, distorted synth sounds with heavy layering capabilities
- Real-time audio effects: delay, chorus, tone shifting, and layering
- Minimal, intuitive controls (dials, knobs, sliders)
- Capable of creating ethereal soundscapes

### Technology Stack Priorities
1. **Audio**: Web Audio API for lowest latency synthesis
2. **Visuals**: WebGL/Canvas for smooth 60fps animations
3. **Platform**: Progressive Web App for mobile optimization
4. **Dependencies**: Minimal external libraries to reduce bundle size and latency

## Architecture

### Audio Engine (`/src/audio/`)
- **Synthesizer core**: Real-time oscillators and filters
- **Effects chain**: Modular effects (distortion, delay, chorus, reverb)
- **Voice management**: Polyphonic voice allocation and management
- **Audio context**: Single AudioContext instance with optimized buffer sizes

### Visual Engine (`/src/visual/`)
- **Fluid simulation**: Oil-like surface dynamics using shaders
- **Color system**: Responsive color mapping tied to audio parameters
- **Touch handling**: Multi-touch gesture recognition for mobile
- **Animation loop**: RequestAnimationFrame-based rendering

### UI Controls (`/src/controls/`)
- **Physical metaphors**: Knob, slider, and dial components
- **Touch optimization**: Large hit targets, haptic feedback
- **Parameter mapping**: Direct audio parameter control
- **Preset system**: Save/load configurations

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Performance Guidelines

### Audio Performance
- Use AudioWorklet processors for custom audio processing
- Pre-allocate audio buffers to avoid garbage collection
- Limit simultaneous voices based on device capabilities
- Use efficient filter implementations (biquad filters)

### Visual Performance
- Batch WebGL draw calls where possible
- Use texture atlases for UI elements
- Implement level-of-detail for complex visual effects
- Monitor frame timing and adjust quality accordingly

### Mobile Optimization
- Implement touch event pooling
- Use passive event listeners where possible
- Minimize main thread blocking operations
- Implement proper memory management for continuous use

## Git Commit Practices

Use conventional commit format:
- `feat:` new features
- `fix:` bug fixes
- `perf:` performance improvements
- `style:` visual/UI changes
- `audio:` audio engine changes
- `refactor:` code refactoring

Example: `feat: add chorus effect to audio chain`

### Attribution for AI-Generated Code

When committing code that was substantially created by Claude AI, include proper attribution:

```
feat: implement complete oil synth with WebGL visuals

- Web Audio API synthesizer with pentatonic scale mapping
- WebGL oil surface with touch-based reveal system
- Five-knob interface (GRIME, FLOW, SHIMMER, DEPTH, PITCH)
- Mobile-optimized with performance scaling
- Touch interaction with visual feedback

🤖 Generated with Claude AI (claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Audio Effect Implementation

When adding new effects:
1. Create effect class extending `AudioEffect`
2. Implement `process()` method with Web Audio nodes
3. Add parameter controls with proper ranges
4. Include wet/dry mix capability
5. Test across different sample rates and buffer sizes

## Visual Effect Guidelines

For oil-surface effects:
- Use fragment shaders for fluid dynamics
- Implement color bleeding between adjacent areas
- Create smooth transitions using interpolation
- Map audio frequencies to visual disturbances
- Consider iridescent color schemes (oil-on-water effect)
