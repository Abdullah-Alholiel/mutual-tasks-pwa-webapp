# Toast Test Suite

This test suite provides a comprehensive testing interface for the Sonner toast notification system.

## Accessing the Test Page

The toast test page is available at:
```
http://localhost:5173/test/toasts
```

(Replace `5173` with your development server port if different)

## Features Tested

### 1. Basic Toasts
- Default toast notifications
- Success toasts (green)
- Error toasts (red)
- Warning toasts (yellow)
- Info toasts (blue)

### 2. Toasts with Actions
- Toasts with undo action buttons
- Success toasts with view actions
- Error toasts with retry actions

### 3. Long Duration Toasts
- Toasts with extended display time (10 seconds)
- Persistent toasts (until manually closed)

### 4. Multiple Toasts
- Testing toast stacking behavior
- Sequential toast display

### 5. Mobile Positioning Test
- Verifies toasts appear at the **top** on mobile (< 768px width)
- Verifies toasts appear at the **bottom-right** on desktop (≥ 768px width)
- Real-time viewport width display
- Dynamic position indication

## Expected Behavior

### Mobile (< 768px width)
- ✅ Toasts appear at the **top** of the screen
- ✅ Proper safe area inset padding for iOS devices with notch
- ✅ Full-width toasts with margins
- ✅ Color-coded left borders for toast types
- ✅ High z-index (9999) to appear above all content

### Desktop (≥ 768px width)
- ✅ Toasts appear at the **bottom-right** corner
- ✅ Maximum width of 420px
- ✅ Rounded corners and shadows
- ✅ Expandable on hover

## Usage

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/test/toasts` in your browser

3. Click the various test buttons to trigger different toast types

4. Resize your browser window or test on an actual mobile device to verify mobile positioning

5. Check the "Mobile Positioning Test" section to see current viewport dimensions and expected toast position

## Testing on Mobile Device

1. Ensure your dev server is accessible on your local network
2. Access `http://[your-local-ip]:5173/test/toasts` from your mobile device
3. Verify that toasts appear at the top of the screen
4. Test on iOS devices to verify safe area inset handling

## Notes

- The test page is publicly accessible (no authentication required)
- All toasts use the Sonner library configured in `src/components/ui/sonner.tsx`
- Toast styling is defined in `src/core/index.css`
- Mobile positioning is handled via CSS media queries and React state





