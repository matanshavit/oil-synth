export class TouchHandler {
    constructor(element, callbacks = {}) {
        this.element = element;
        this.callbacks = callbacks;
        this.touches = new Map();
        this.isEnabled = false;
        
        // Bind event handlers
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        
        // Mouse state for desktop
        this.mouseDown = false;
        this.mouseId = 'mouse';
    }
    
    enable() {
        if (this.isEnabled) return;
        
        // Touch events
        this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.element.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.element.addEventListener('touchend', this.onTouchEnd, { passive: false });
        this.element.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
        
        // Mouse events for desktop testing
        this.element.addEventListener('mousedown', this.onMouseDown, { passive: false });
        this.element.addEventListener('mousemove', this.onMouseMove, { passive: false });
        this.element.addEventListener('mouseup', this.onMouseUp, { passive: false });
        this.element.addEventListener('mouseleave', this.onMouseUp, { passive: false });
        
        // Prevent context menu
        this.element.addEventListener('contextmenu', (e) => e.preventDefault());
        
        this.isEnabled = true;
    }
    
    disable() {
        if (!this.isEnabled) return;
        
        this.element.removeEventListener('touchstart', this.onTouchStart);
        this.element.removeEventListener('touchmove', this.onTouchMove);
        this.element.removeEventListener('touchend', this.onTouchEnd);
        this.element.removeEventListener('touchcancel', this.onTouchEnd);
        
        this.element.removeEventListener('mousedown', this.onMouseDown);
        this.element.removeEventListener('mousemove', this.onMouseMove);
        this.element.removeEventListener('mouseup', this.onMouseUp);
        this.element.removeEventListener('mouseleave', this.onMouseUp);
        this.element.removeEventListener('contextmenu', (e) => e.preventDefault());
        
        this.touches.clear();
        this.mouseDown = false;
        this.isEnabled = false;
    }
    
    onTouchStart(event) {
        event.preventDefault();
        
        const rect = this.element.getBoundingClientRect();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const id = touch.identifier;
            
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            // Calculate pressure/intensity (fallback to 1.0 if not available)
            const intensity = touch.force || 1.0;
            
            this.touches.set(id, { x, y, intensity, startTime: performance.now() });
            
            if (this.callbacks.onTouchStart) {
                this.callbacks.onTouchStart(id, x, y, intensity);
            }
        }
    }
    
    onTouchMove(event) {
        event.preventDefault();
        
        const rect = this.element.getBoundingClientRect();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const id = touch.identifier;
            
            if (!this.touches.has(id)) continue;
            
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const intensity = touch.force || 1.0;
            
            const touchData = this.touches.get(id);
            touchData.x = x;
            touchData.y = y;
            touchData.intensity = intensity;
            
            if (this.callbacks.onTouchMove) {
                this.callbacks.onTouchMove(id, x, y, intensity);
            }
        }
    }
    
    onTouchEnd(event) {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const id = touch.identifier;
            
            if (this.touches.has(id)) {
                const touchData = this.touches.get(id);
                const duration = performance.now() - touchData.startTime;
                
                if (this.callbacks.onTouchEnd) {
                    this.callbacks.onTouchEnd(id, touchData.x, touchData.y, duration);
                }
                
                this.touches.delete(id);
            }
        }
    }
    
    // Mouse events for desktop
    onMouseDown(event) {
        event.preventDefault();
        
        if (this.mouseDown) return;
        
        this.mouseDown = true;
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const intensity = 1.0;
        
        this.touches.set(this.mouseId, { x, y, intensity, startTime: performance.now() });
        
        if (this.callbacks.onTouchStart) {
            this.callbacks.onTouchStart(this.mouseId, x, y, intensity);
        }
    }
    
    onMouseMove(event) {
        if (!this.mouseDown) return;
        
        event.preventDefault();
        
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const intensity = 1.0;
        
        if (this.touches.has(this.mouseId)) {
            const touchData = this.touches.get(this.mouseId);
            touchData.x = x;
            touchData.y = y;
            touchData.intensity = intensity;
            
            if (this.callbacks.onTouchMove) {
                this.callbacks.onTouchMove(this.mouseId, x, y, intensity);
            }
        }
    }
    
    onMouseUp(event) {
        if (!this.mouseDown) return;
        
        event.preventDefault();
        this.mouseDown = false;
        
        if (this.touches.has(this.mouseId)) {
            const touchData = this.touches.get(this.mouseId);
            const duration = performance.now() - touchData.startTime;
            
            if (this.callbacks.onTouchEnd) {
                this.callbacks.onTouchEnd(this.mouseId, touchData.x, touchData.y, duration);
            }
            
            this.touches.delete(this.mouseId);
        }
    }
    
    // Get normalized coordinates (0-1)
    getNormalizedCoords(x, y) {
        const rect = this.element.getBoundingClientRect();
        return {
            x: x / rect.width,
            y: y / rect.height
        };
    }
    
    // Get all active touches
    getActiveTouches() {
        return Array.from(this.touches.values());
    }
    
    // Get touch count
    getTouchCount() {
        return this.touches.size;
    }
    
    // Clear all touches (useful for cleanup)
    clearTouches() {
        if (this.callbacks.onTouchEnd) {
            for (const [id, touchData] of this.touches) {
                const duration = performance.now() - touchData.startTime;
                this.callbacks.onTouchEnd(id, touchData.x, touchData.y, duration);
            }
        }
        
        this.touches.clear();
        this.mouseDown = false;
    }
}