# Calendar UI Redesign - Quick Reference

## Key Improvements Summary

### 1. Compact Design (30% Space Reduction)
- **Before**: Rectangular cards, 72px height
- **After**: Circular pickers, 48-52px height
- **Impact**: More vertical space for tasks, better content visibility

### 2. Circular Day Pickers
- **Before**: Rectangular rounded-xl cards
- **After**: Perfect circles (rounded-full)
- **Impact**: Distinctive, memorable design that stands out

### 3. Today Always Centered
- **Before**: Today may not be visible
- **After**: Auto-center on mount + scroll-to-today button
- **Impact**: Instant orientation, better UX

### 4. Premium Micro-interactions
- **Before**: Basic hover states
- **After**: Spring animations, pulse effects, smooth transitions
- **Impact**: Delightful, polished feel

---

## Implementation Checklist

### Core Changes (Must Have)
- [ ] Change day cards from rectangular to circular
- [ ] Reduce height from 72px to 48-52px
- [ ] Implement center-today logic on component mount
- [ ] Update typography scaling (9-10px letters, 18-20px numbers)

### Visual Polish (Should Have)
- [ ] Add spring-based animations (stiffness: 400, damping: 30)
- [ ] Create today indicator with pulsing dot
- [ ] Add selection state with glow effect
- [ ] Implement staggered entry animation (40ms per day)

### Responsive & Accessibility (Nice to Have)
- [ ] Mobile: 40px day pickers
- [ ] Desktop: 44px day pickers
- [ ] Keyboard navigation (Tab, Enter, Space)
- [ ] Screen reader announcements
- [ ] Reduced motion support

---

## Code Changes Required

### File: `src/components/TaskCalendar.tsx`

#### Change 1: Day Button Shape
```tsx
// OLD
className="flex-1 min-h-[72px] rounded-xl flex flex-col items-center justify-center"

// NEW
className="w-10 h-10 md:w-11 md:h-11 rounded-full flex flex-col items-center justify-center"
```

#### Change 2: Typography Scaling
```tsx
// OLD
<span className="text-[10px] font-semibold uppercase tracking-wider mb-1">
  {dayLetter}
</span>
<span className="text-2xl font-bold">
  {dayNumber}
</span>

// NEW
<span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-widest">
  {dayLetter}
</span>
<span className="text-[18px] md:text-[20px] font-bold">
  {dayNumber}
</span>
```

#### Change 3: Today Indicator
```tsx
// ADD THIS
{isToday && !isSelected && (
  <motion.div
    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 2, repeat: Infinity }}
    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
  />
)}
```

#### Change 4: Selection State
```tsx
// ADD THIS
{isSelected && (
  <motion.div
    animate={{
      boxShadow: [
        "0 0 20px -5px rgba(var(--primary-rgb), 0.3)",
        "0 0 30px -5px rgba(var(--primary-rgb), 0.5)",
        "0 0 20px -5px rgba(var(--primary-rgb), 0.3)"
      ]
    }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    className="absolute inset-0 rounded-full"
  />
)}
```

#### Change 5: Center-Today Logic
```tsx
// ADD THIS FUNCTION
const centerToday = useCallback(() => {
  const todayIndex = weekDates.findIndex(date => isSameDay(date, today));
  if (todayIndex !== -1) {
    const centerOffset = Math.floor(weekDates.length / 2);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - (todayIndex - centerOffset));
    setCurrentDate(targetDate);
  }
}, [today, weekDates]);

// ADD THIS EFFECT
useEffect(() => {
  centerToday();
}, [centerToday]);

// UPDATE TODAY BUTTON HANDLER
const handleGoToToday = () => {
  setInternalDate(undefined);
  onDateChange?.(undefined);
  centerToday(); // Use centering logic instead of just setting to new Date()
};
```

#### Change 6: Spring Animation Config
```tsx
// ADD THIS CONSTANT
const springConfig = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8
};

// USE IN ANIMATIONS
transition={{ ...springConfig, delay: 0.6 + (index * 0.04) }}
```

---

## Design System Alignment

### Colors
- **Primary**: Selection state, today indicator
- **Muted**: Unselected days, navigation buttons
- **Accent**: Hover states
- **Foreground**: Day numbers, labels

### Typography
- **Font**: Satoshi (already in use)
- **Day letters**: 9-10px, uppercase, tracking-widest
- **Day numbers**: 18-20px, bold
- **Month label**: 14px, semibold

### Spacing
- **Container padding**: 12px (p-3)
- **Day gap**: 8px (gap-2)
- **Navigation spacing**: 8px between buttons

### Animation
- **Spring physics**: Stiffness 400, Damping 30
- **Duration**: 200-300ms for transitions
- **Stagger**: 40ms between sequential elements

---

## Testing Checklist

### Visual Tests
- [ ] Day cards are circular (not rectangular)
- [ ] Height is 48-52px (not 72px)
- [ ] Today is centered on initial load
- [ ] Today button centers today when clicked
- [ ] Selection state has glow effect
- [ ] Today indicator pulses smoothly

### Functional Tests
- [ ] Date filtering works correctly
- [ ] Prev/Next week navigation works
- [ ] Today button resets selection
- [ ] Selected date persists across navigation

### Responsive Tests
- [ ] Mobile (375px): 40px day pickers
- [ ] Tablet (640px+): 44px day pickers
- [ ] Desktop (768px+): 44px day pickers

### Accessibility Tests
- [ ] Keyboard navigation (Tab, Enter, Space)
- [ ] Screen reader announces day, today status, selection
- [ ] Focus indicators visible
- [ ] Touch targets meet 44x44px minimum

### Performance Tests
- [ ] Animations run at 60fps
- [ ] No layout thrashing
- [ ] GPU acceleration active (transform, opacity only)
- [ ] Reduced motion respected

---

## Success Metrics

### Quantitative
- **Vertical space reduction**: 30% (72px → 50px average)
- **Animation performance**: 60fps on all devices
- **Touch target compliance**: 100% (44x44px minimum)
- **Accessibility score**: 95+ (Lighthouse)

### Qualitative
- Instant recognition of today's date
- Smooth, predictable animations
- Clear visual hierarchy
- Delightful micro-interactions
- Compact without feeling cramped

---

## Common Issues & Solutions

### Issue: Today not centered on mount
**Solution**: Ensure `centerToday` is called in `useEffect` with correct dependencies

### Issue: Animations feel jerky
**Solution**: Use `transform` and `opacity` only, avoid animating layout properties

### Issue: Day cards look rectangular
**Solution**: Ensure `rounded-full` class is applied and width/height are equal

### Issue: Typography too large
**Solution**: Use responsive text sizes: `text-[9px] md:text-[10px]` and `text-[18px] md:text-[20px]`

### Issue: Glow effect not visible
**Solution**: Ensure `--primary-rgb` CSS variable is defined in theme

---

## Next Steps

1. **Review** this quick reference document
2. **Approve** the implementation plan
3. **Switch** to Code mode for implementation
4. **Implement** changes following the checklist
5. **Test** against the testing checklist
6. **Deploy** to production after approval

---

**Document Version:** 1.0
**Related Documents:**
- [`calendar-ui-redesign.md`](./calendar-ui-redesign.md) - Full design specifications
- [`session-ses_3b88.md`](../session-ses_3b88.md) - Original session context
