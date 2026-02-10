// ============================================================================
// DateTime Picker Component - Combined Date and Time Selection
// ============================================================================
//
// A reusable component for selecting both date and time.
// Combines a calendar with a time input for full date-time selection.
// ============================================================================

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Clock } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    formatDueDateTime,
    hasTimeComponent,
    getTimeStringFromDate,
    combineDateTime,
} from '@/lib/datetime/datetimeUtils';

interface DateTimePickerProps {
    value?: Date;
    onChange: (date: Date | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    showTime?: boolean;
    className?: string;
    id?: string;
    label?: string;
}

/**
 * DateTimePicker - Combined date and time picker component
 *
 * Features:
 * - Calendar for date selection
 * - Time input for time selection (optional)
 * - Shows time if already set
 * - Formats display with relative labels (Today, Tomorrow, etc.)
 */
export const DateTimePicker = ({
    value,
    onChange,
    placeholder = 'Select date and time',
    disabled = false,
    showTime = true,
    className,
    id,
    label,
}: DateTimePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [timeInput, setTimeInput] = useState<string>(
        value ? getTimeStringFromDate(value) : '00:00'
    );

    // Update time input when value changes externally
    if (value && getTimeStringFromDate(value) !== timeInput) {
        setTimeInput(getTimeStringFromDate(value));
    }

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) {
            onChange(undefined);
            return;
        }

        // Combine selected date with current time input
        const combined = combineDateTime(date, timeInput);
        onChange(combined);
        setIsOpen(false);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTimeInput = e.target.value;
        setTimeInput(newTimeInput);

        // If we have a date value, update it with the new time
        if (value) {
            const combined = combineDateTime(value, newTimeInput);
            onChange(combined);
        }
    };

    const handleClear = () => {
        onChange(undefined);
        setTimeInput('00:00');
    };

    const hasTime = value ? hasTimeComponent(value) : false;
    const displayValue = value ? formatDueDateTime(value) : placeholder;

    return (
        <div className={cn('space-y-2', className)}>
            {label && (
                <Label htmlFor={id} className="text-sm font-medium">
                    {label}
                </Label>
            )}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            'w-full justify-start text-left font-normal',
                            !value && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {displayValue}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 space-y-3">
                        {/* Calendar */}
                        <Calendar
                            mode="single"
                            selected={value}
                            onSelect={handleDateSelect}
                            initialFocus
                            className="pointer-events-auto"
                        />

                        {/* Time Input */}
                        {showTime && (
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor={`${id}-time`} className="text-sm">
                                        Time
                                    </Label>
                                </div>
                                <Input
                                    id={`${id}-time`}
                                    type="time"
                                    value={timeInput}
                                    onChange={handleTimeChange}
                                    disabled={disabled || !value}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Clear Button */}
                        {value && (
                            <div className="pt-2 border-t">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClear}
                                    disabled={disabled}
                                    className="w-full"
                                >
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

DateTimePicker.displayName = 'DateTimePicker';
