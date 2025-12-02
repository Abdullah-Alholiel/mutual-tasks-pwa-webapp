import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Project, User } from '@/types';
import { mockUsers, currentUser } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { FolderKanban, Users, Sparkles, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const PROJECT_COLORS = [
  { name: 'Blue', value: 'hsl(199, 89%, 48%)' },
  { name: 'Green', value: 'hsl(142, 76%, 36%)' },
  { name: 'Orange', value: 'hsl(32, 95%, 58%)' },
  { name: 'Purple', value: 'hsl(280, 70%, 50%)' },
  { name: 'Pink', value: 'hsl(340, 75%, 55%)' },
  { name: 'Teal', value: 'hsl(180, 70%, 45%)' },
];

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (project: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
  }) => void;
}

export const ProjectForm = ({ open, onOpenChange, onSubmit }: ProjectFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0].value);
  const [isPublic, setIsPublic] = useState(true);

  const availableFriends = mockUsers.filter(u => u.id !== currentUser.id);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    // For private projects: require at least 1 participant (creator + one friend)
    // For public projects: can create without additional participants (add members later)
    if (!isPublic && selectedParticipants.length < 1) {
      toast.error('Private project requires at least one friend', {
        description: 'Add at least one friend to create a private project'
      });
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      participants: selectedParticipants,
      color: selectedColor,
      isPublic
    });

    // Reset form
    setName('');
    setDescription('');
    setSelectedParticipants([]);
    setSelectedColor(PROJECT_COLORS[0].value);
    setIsPublic(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            <DialogTitle>Create New Project</DialogTitle>
          </div>
          <DialogDescription>
            Start a new collaborative project with your friends
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Morning Routine, Fitness Challenge"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {isPublic ? (
                  <Globe className="w-5 h-5 text-primary" />
                ) : (
                  <Lock className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <Label htmlFor="isPublic" className="cursor-pointer">
                  {isPublic ? 'Public Project' : 'Private Project'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? 'Anyone can view this project' : 'Only members can view this project'}
                </p>
              </div>
            </div>
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Project Color</Label>
            <div className="grid grid-cols-3 gap-3">
              {PROJECT_COLORS.map((color) => (
                <motion.button
                  key={color.value}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border-2 transition-all",
                    selectedColor === color.value
                      ? "border-primary bg-primary/5 shadow-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-sm font-medium">{color.name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label>Add Friends *</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableFriends.map((user) => (
                <motion.button
                  key={user.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleParticipant(user.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    selectedParticipants.includes(user.id)
                      ? "border-primary bg-primary/5 shadow-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Avatar className="w-10 h-10 ring-2 ring-border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.handle}</div>
                  </div>
                  {selectedParticipants.includes(user.id) && (
                    <Badge variant="default" className="shrink-0">Selected</Badge>
                  )}
                </motion.button>
              ))}
            </div>
            {availableFriends.length === 0 && (
              <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Users className="w-4 h-4" />
                <span>No friends available. Add friends to collaborate!</span>
              </div>
            )}
          </div>

          {/* Info Badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> You can add more participants 
              and tasks later. Projects help you organize and track your collaborative goals! 🎯
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || selectedParticipants.length === 0}
              className="flex-1 gradient-primary text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

