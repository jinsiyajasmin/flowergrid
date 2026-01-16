/**
 * AnimateIcon Component - Usage Examples
 * 
 * This file demonstrates all the available animation types
 * for the AnimateIcon wrapper component.
 */

import React from 'react';
import AnimateIcon from './components/AnimateIcon';
import { Menu } from 'lucide-react';

// Example 1: Rotate and Scale (Default for hamburger menu)
export function RotateScaleExample() {
    return (
        <AnimateIcon animateOnHover animationType="rotate-scale">
            <Menu size={24} />
        </AnimateIcon>
    );
}

// Example 2: Scale Only
export function ScaleExample() {
    return (
        <AnimateIcon animateOnHover animationType="scale">
            <Menu size={24} />
        </AnimateIcon>
    );
}

// Example 3: Bounce (Used for sidebar menu items)
export function BounceExample() {
    return (
        <AnimateIcon animateOnHover animationType="bounce">
            <img
                src="/path/to/icon.svg"
                alt="icon"
                style={{ width: 22, height: 22 }}
            />
        </AnimateIcon>
    );
}

// Example 4: Pulse
export function PulseExample() {
    return (
        <AnimateIcon animateOnHover animationType="pulse">
            <Menu size={24} />
        </AnimateIcon>
    );
}

// Example 5: No Animation (animateOnHover=false)
export function NoAnimationExample() {
    return (
        <AnimateIcon animateOnHover={false}>
            <Menu size={24} />
        </AnimateIcon>
    );
}

// Example 6: With Custom Styling
export function CustomStyledExample() {
    return (
        <AnimateIcon
            animateOnHover
            animationType="bounce"
            sx={{
                color: '#EDDBBF',
                padding: 1,
                borderRadius: 2,
            }}
        >
            <Menu size={24} />
        </AnimateIcon>
    );
}

/**
 * Available Animation Types:
 * 
 * 1. 'rotate-scale' - Rotates 90° and scales to 1.15x (hamburger menu)
 * 2. 'scale' - Scales to 1.2x
 * 3. 'bounce' - Moves up 4px and scales to 1.1x (sidebar icons)
 * 4. 'pulse' - Scales to 1.15x with brightness increase
 * 
 * All animations include:
 * - Smooth 300ms cubic-bezier transition
 * - Click feedback (scales down to 0.95x on active)
 */
