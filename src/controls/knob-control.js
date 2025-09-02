export class KnobControl {
    constructor(element, options = {}) {
        this.element = element;
        this.handle = element.querySelector('.knob-handle');
        this.label = element.parentElement.querySelector('label');
        
        // Configuration
        this.options = {
            min: 0,
            max: 1,
            step: 0.01,
            initialValue: 0.5,
            sensitivity: 0.005,
            snapToCenter: false,
            ...options
        };
        
        // State
        this.value = this.options.initialValue;
        this.isDragging = false;
        this.startY = 0;
        this.startValue = 0;
        this.callbacks = [];
        
        // Visual state
        this.rotation = this.valueToRotation(this.value);
        
        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onDoubleClick = this.onDoubleClick.bind(this);
        
        this.setupEvents();
        this.updateVisual();
    }
    
    setupEvents() {
        // Mouse events
        this.element.addEventListener('mousedown', this.onMouseDown);
        this.element.addEventListener('dblclick', this.onDoubleClick);
        
        // Touch events
        this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
        
        // Global move and up events will be added/removed dynamically
        this.globalMouseMove = this.onMouseMove.bind(this);
        this.globalMouseUp = this.onMouseUp.bind(this);
        this.globalTouchMove = this.onTouchMove.bind(this);
        this.globalTouchEnd = this.onTouchEnd.bind(this);
    }
    
    onMouseDown(event) {
        if (event.button !== 0) return; // Only left mouse button
        
        event.preventDefault();
        this.startDrag(event.clientY);
        
        document.addEventListener('mousemove', this.globalMouseMove);
        document.addEventListener('mouseup', this.globalMouseUp);
        
        this.element.classList.add('dragging');
    }
    
    onMouseMove(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        this.updateFromDrag(event.clientY);
    }
    
    onMouseUp(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        this.endDrag();
        
        document.removeEventListener('mousemove', this.globalMouseMove);
        document.removeEventListener('mouseup', this.globalMouseUp);
        
        this.element.classList.remove('dragging');
    }
    
    onTouchStart(event) {
        if (event.touches.length !== 1) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        this.startDrag(touch.clientY);
        
        document.addEventListener('touchmove', this.globalTouchMove, { passive: false });
        document.addEventListener('touchend', this.globalTouchEnd, { passive: false });
        document.addEventListener('touchcancel', this.globalTouchEnd, { passive: false });
        
        this.element.classList.add('dragging');
    }
    
    onTouchMove(event) {
        if (!this.isDragging || event.touches.length !== 1) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        this.updateFromDrag(touch.clientY);
    }
    
    onTouchEnd(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        this.endDrag();
        
        document.removeEventListener('touchmove', this.globalTouchMove);
        document.removeEventListener('touchend', this.globalTouchEnd);
        document.removeEventListener('touchcancel', this.globalTouchEnd);
        
        this.element.classList.remove('dragging');
    }
    
    onDoubleClick(event) {
        event.preventDefault();
        this.setValue(this.options.initialValue);
    }
    
    startDrag(clientY) {
        this.isDragging = true;
        this.startY = clientY;
        this.startValue = this.value;
        
        // Add haptic feedback on mobile
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }
    
    updateFromDrag(clientY) {
        const deltaY = this.startY - clientY; // Inverted: up = positive
        const deltaValue = deltaY * this.options.sensitivity;
        const newValue = this.startValue + deltaValue;
        
        this.setValue(newValue);
    }
    
    endDrag() {
        this.isDragging = false;
        
        // Snap to center if enabled and close enough
        if (this.options.snapToCenter) {
            const center = (this.options.min + this.options.max) / 2;
            const snapThreshold = (this.options.max - this.options.min) * 0.05;
            
            if (Math.abs(this.value - center) < snapThreshold) {
                this.setValue(center);
            }
        }
    }
    
    setValue(value, notify = true) {
        // Clamp value to range
        const clampedValue = Math.max(this.options.min, Math.min(this.options.max, value));
        
        // Apply step if specified
        let steppedValue = clampedValue;
        if (this.options.step > 0) {
            const steps = Math.round((clampedValue - this.options.min) / this.options.step);
            steppedValue = this.options.min + (steps * this.options.step);
        }
        
        if (steppedValue !== this.value) {
            this.value = steppedValue;
            this.rotation = this.valueToRotation(this.value);
            this.updateVisual();
            
            if (notify) {
                this.notifyChange();
            }
        }
    }
    
    getValue() {
        return this.value;
    }
    
    valueToRotation(value) {
        // Map value to rotation angle (-135° to +135°, 270° total range)
        const normalizedValue = (value - this.options.min) / (this.options.max - this.options.min);
        return -135 + (normalizedValue * 270);
    }
    
    updateVisual() {
        if (this.handle) {
            this.handle.style.transform = `translateX(-50%) rotate(${this.rotation}deg)`;
        }
        
        // Update accessibility attributes
        this.element.setAttribute('aria-valuenow', this.value.toFixed(3));
        this.element.setAttribute('aria-valuemin', this.options.min);
        this.element.setAttribute('aria-valuemax', this.options.max);
        
        // Update label with parameter name and value
        if (this.label) {
            const percentage = Math.round(((this.value - this.options.min) / (this.options.max - this.options.min)) * 100);
            this.label.textContent = `${this.label.textContent.split(' ')[0]} ${percentage}%`;
        }
    }
    
    onChange(callback) {
        this.callbacks.push(callback);
        return this; // For chaining
    }
    
    notifyChange() {
        this.callbacks.forEach(callback => {
            try {
                callback(this.value, this);
            } catch (error) {
                console.error('Error in knob change callback:', error);
            }
        });
    }
    
    // Programmatic control
    increment(steps = 1) {
        const stepSize = this.options.step || ((this.options.max - this.options.min) / 100);
        this.setValue(this.value + (stepSize * steps));
    }
    
    decrement(steps = 1) {
        this.increment(-steps);
    }
    
    reset() {
        this.setValue(this.options.initialValue);
    }
    
    // Cleanup
    destroy() {
        this.element.removeEventListener('mousedown', this.onMouseDown);
        this.element.removeEventListener('dblclick', this.onDoubleClick);
        this.element.removeEventListener('touchstart', this.onTouchStart);
        
        // Remove global listeners (in case they're still attached)
        document.removeEventListener('mousemove', this.globalMouseMove);
        document.removeEventListener('mouseup', this.globalMouseUp);
        document.removeEventListener('touchmove', this.globalTouchMove);
        document.removeEventListener('touchend', this.globalTouchEnd);
        document.removeEventListener('touchcancel', this.globalTouchEnd);
        
        this.callbacks = [];
    }
}

// Utility function to create multiple knobs
export function createKnobControls(containerSelector, options = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return [];
    
    const knobElements = container.querySelectorAll('.knob');
    const knobs = [];
    
    knobElements.forEach(element => {
        const paramName = element.dataset.param;
        const knobOptions = {
            ...options,
            ...(options[paramName] || {})
        };
        
        const knob = new KnobControl(element, knobOptions);
        knob.paramName = paramName;
        knobs.push(knob);
    });
    
    return knobs;
}