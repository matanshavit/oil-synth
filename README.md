# Oil Synth

A mobile-first audio synthesizer with fluid, oil-like visual interface. Touch the surface to create grimey, distorted synth sounds with real-time effects and loop recording capabilities.

## Features

### Audio Engine
- **Real-time synthesis** with Web Audio API for minimal latency
- **Pentatonic scale mapping** with quantized pitch steps for musical harmony
- **Polyphonic voices** with automatic voice management
- **Built-in effects**: Distortion, delay, chorus, and dynamic filtering
- **Loop recording** with overdubbing support and additive mixing
- **Touch-responsive parameters** mapped to screen coordinates

### Visual Interface
- **WebGL oil surface** with fluid dynamics and shader-based rendering
- **Touch-based reveal system** that unveils the oil surface on first interaction
- **Real-time color blending** tied to audio parameters
- **Responsive animations** optimized for 60fps on mobile devices
- **Iridescent color schemes** inspired by oil-on-water effects

### Controls
- **5-knob interface**: GRIME, FLOW, SHIMMER, DEPTH, PITCH
- **Loop controls**: Record, Play/Pause, Volume, Clear with progress indicator
- **Mobile-optimized** with large touch targets and haptic feedback
- **Performance scaling** based on device capabilities

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/oil-synth.git
cd oil-synth

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open your browser to `http://localhost:5173` and tap the screen to begin!

## Development

### Tech Stack
- **Audio**: Web Audio API with MediaRecorder for loop recording
- **Visuals**: WebGL with custom fragment shaders
- **Build**: Vite for fast development and optimized production builds
- **Performance**: Adaptive quality based on device capabilities and battery status

### Project Structure
```
src/
├── audio/           # Audio synthesis and effects
│   ├── synthesizer.js      # Core audio engine
│   └── loop-controller.js  # Loop recording system
├── visual/          # WebGL rendering and shaders
│   └── oil-surface.js      # Fluid oil surface simulation
├── controls/        # UI components and interaction
│   ├── knob-control.js     # Rotary knob controls
│   ├── loop-controls.js    # Loop panel interface
│   └── touch-handler.js    # Multi-touch gesture handling
├── utils/           # Performance optimization utilities
└── styles/          # CSS styling
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Lint code
npm run typecheck    # Type checking
npm run preview      # Preview production build
```

### Performance Guidelines

**Audio Performance**
- Pre-allocated audio buffers to avoid garbage collection
- Voice limiting based on device capabilities
- Efficient filter implementations using Web Audio API nodes

**Visual Performance**
- Batched WebGL draw calls
- Level-of-detail adjustments for complex effects
- Frame timing monitoring with automatic quality scaling

**Mobile Optimization**
- Touch event pooling for smooth interaction
- Passive event listeners where possible
- Memory management for continuous use

## Usage

### Basic Playing
1. **Tap anywhere** on the dark surface to reveal the oil interface
2. **Touch and drag** to create sounds - position affects pitch and timbre
3. **Use multiple fingers** for polyphonic playing
4. **Adjust knobs** to modify the sound character in real-time

### Loop Recording
1. **Press Record** to start capturing a loop
2. **Play and record** your performance - loop length is automatic
3. **Press Record again** while playing to overdub additional layers
4. **Use Play/Pause** to control playback
5. **Adjust Volume** knob to mix loop level
6. **Press Clear** to remove the current loop

### Sound Parameters
- **GRIME**: Controls distortion and harmonic saturation
- **FLOW**: Adjusts filter cutoff and resonance
- **SHIMMER**: Modulates chorus and stereo effects
- **DEPTH**: Controls reverb and spatial depth
- **PITCH**: Sets pitch range (7 quantized musical steps)

## Browser Compatibility

- **Chrome/Edge**: Full support with optimal performance
- **Firefox**: Full support with good performance
- **Safari**: Full support (iOS Safari optimized for mobile)
- **Mobile browsers**: Optimized experience with touch controls

**Requirements**: Modern browser with Web Audio API and WebGL support

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and architecture patterns
4. Test on both desktop and mobile devices
5. Commit with conventional commit format (`feat:`, `fix:`, etc.)
6. Push to your branch and create a Pull Request

### Commit Convention
```
feat: add chorus effect to audio chain
fix: resolve touch event handling on iOS
perf: optimize WebGL rendering pipeline
style: update oil surface color palette
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Web Audio API and WebGL
- Inspired by analog synthesizers and fluid dynamics
- Optimized for mobile-first audio performance

---

**🎵 Create ethereal soundscapes with touch 🎨**
