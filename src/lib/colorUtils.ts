export const adjustColorOpacity = (color: string, opacity: number): string => {
    if (!color) return color;

    // Handle HSL/HSLA
    if (color.startsWith('hsl')) {
        // Remove existing alpha if present and closing parenthesis
        const core = color.replace(/hsla?\(/, '').replace(/\)/, '').split(',').slice(0, 3).join(',');

        // Check if it's using space separation (modern syntax) or commas
        if (color.includes(',')) {
            return `hsla(${core}, ${opacity})`;
        } else {
            // Modern syntax: hsl(h s l / a)
            const coreSpace = color.replace(/hsla?\(/, '').replace(/\)/, '').split('/')[0].trim();
            return `hsl(${coreSpace} / ${opacity})`;
        }
    }

    // Handle Hex
    if (color.startsWith('#')) {
        let hex = color.slice(1);

        // Expand shorthand hex
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }

        // Ensure we have 6 digits
        if (hex.length === 6) {
            const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
            return `#${hex}${alpha}`;
        }
    }

    // Return original if unknown format (e.g. named colors)
    // Ideally, we shouldn't reach here with controlled inputs
    return color;
};
