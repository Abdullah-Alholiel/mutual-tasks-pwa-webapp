import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

interface DifficultyRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number) => void;
  taskTitle: string;
}

export const DifficultyRatingModal = ({
  open,
  onOpenChange,
  onSubmit,
  taskTitle
}: DifficultyRatingModalProps) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const ratings = [
    { value: 1, label: 'Easy', emoji: '😌' },
    { value: 2, label: 'Moderate', emoji: '🙂' },
    { value: 3, label: 'Challenging', emoji: '😅' },
    { value: 4, label: 'Hard', emoji: '😰' },
    { value: 5, label: 'Extreme', emoji: '🔥' }
  ];

  const handleSubmit = () => {
    if (selectedRating) {
      onSubmit(selectedRating);
      setSelectedRating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <DialogTitle>Task Completed!</DialogTitle>
          </div>
          <DialogDescription>
            How difficult was "{taskTitle}"?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="grid grid-cols-5 gap-3">
            {ratings.map((rating) => (
              <motion.button
                key={rating.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedRating(rating.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  selectedRating === rating.value
                    ? 'border-primary bg-primary/5 shadow-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="text-2xl">{rating.emoji}</span>
                <span className="text-xs font-medium text-center leading-tight">
                  {rating.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedRating(null);
            }}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedRating}
            className="flex-1 gradient-primary text-white"
          >
            Submit Rating
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
