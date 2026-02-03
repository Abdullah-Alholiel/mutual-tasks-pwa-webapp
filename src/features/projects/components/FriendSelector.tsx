import { useState, useEffect, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
import type { User } from '@/types';

interface FriendSelectorProps {
  availableFriends: User[];
  selectedUserIds: string[];
  highlightedUserIds?: Set<string>;
  onToggleUser: (userId: string) => void;
  selectedColor?: string;
  emptyMessage?: string;
  maxHeight?: string;
}

export const FriendSelector = ({
  availableFriends,
  selectedUserIds,
  highlightedUserIds = new Set(),
  onToggleUser,
  selectedColor = 'hsl(199, 89%, 48%)',
  emptyMessage = 'No friends available',
  maxHeight = '300px'
}: FriendSelectorProps) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);

  if (availableFriends.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 bg-muted rounded-lg">
        <Users className="w-4 h-4" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, userIdStr: string, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleUser(userIdStr);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(Math.min(index + 1, availableFriends.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(Math.max(index - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(availableFriends.length - 1);
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && containerRef) {
      const buttons = containerRef.querySelectorAll('button[type="button"]');
      const focusedButton = buttons[focusedIndex] as HTMLButtonElement;
      focusedButton?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      focusedButton?.focus();
    }
  }, [focusedIndex, availableFriends]);

  return (
    <div 
      ref={setContainerRef}
      className="overflow-y-auto custom-scrollbar p-1 space-y-2" 
      style={{ maxHeight }}
      role="listbox"
      aria-label="Select friends"
    >
      {availableFriends.map((user, index) => {
        const userIdStr = String(user.id);
        const isSelected = selectedUserIds.includes(userIdStr);
        const isHighlighted = highlightedUserIds.has(userIdStr);
        const isFocused = focusedIndex === index;

        return (
          <motion.button
            key={user.id}
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onToggleUser(userIdStr)}
            onKeyDown={(e) => handleKeyDown(e, userIdStr, index)}
            onMouseEnter={() => setFocusedIndex(index)}
            aria-pressed={isSelected}
            aria-selected={isSelected}
            tabIndex={isFocused ? 0 : -1}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all text-left relative w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : isHighlighted
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-primary/50",
              isFocused && "ring-2 ring-ring"
            )}
            style={isSelected ? { borderColor: selectedColor, backgroundColor: `${selectedColor}08` } : {}}
          >
            {isHighlighted && !isSelected && (
              <Badge variant="secondary" className="text-xs absolute top-1 right-1">New</Badge>
            )}
            <Avatar className="w-8 h-8 ring-2 ring-border flex-shrink-0">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="text-xs">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="font-medium text-sm leading-tight">{user.name}</div>
              <div className="text-xs text-muted-foreground leading-tight font-medium">{user.handle}</div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
