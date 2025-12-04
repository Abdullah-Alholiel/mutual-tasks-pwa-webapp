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
    { value: 1, label: 'Very Easy', emoji: '😌', description: 'A breeze, no effort needed' },
    { value: 2, label: 'Easy', emoji: '🙂', description: 'Simple and straightforward' },
    { value: 3, label: 'Moderate', emoji: '😐', description: 'Some effort required' },
    { value: 4, label: 'Challenging', emoji: '😅', description: 'Took real effort to complete' },
    { value: 5, label: 'Very Hard', emoji: '😰', description: 'Extremely difficult, pushed my limits' }
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
          <div className="grid grid-cols-5 gap-2">
            {ratings.map((rating) => (
              <motion.button
                key={rating.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedRating(rating.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all ${
                  selectedRating === rating.value
                    ? 'border-primary bg-primary/5 shadow-primary'
                    : 'border-border hover:border-primary/50'
                }`}
                title={`${rating.label} - ${rating.description}`}
              >
                <span className="text-xl">{rating.emoji}</span>
                <span className="text-xs font-bold text-center leading-tight">
                  {rating.value}
                </span>
              </motion.button>
            ))}
          </div>
          {selectedRating && (
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {ratings.find(r => r.value === selectedRating)?.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {ratings.find(r => r.value === selectedRating)?.description}
              </p>
            </div>
          )}
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
