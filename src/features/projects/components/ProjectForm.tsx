import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Project, User } from '@/types';
import { mockUsers, currentUser } from '@/lib/mock/mockData';
import { motion } from 'framer-motion';
import { FolderKanban, Users, Sparkles, Globe, Lock, AtSign, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';

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
  const [friendHandle, setFriendHandle] = useState('');
  const [highlightedFriendIds, setHighlightedFriendIds] = useState<Set<string>>(new Set());

  // Get all available friends (existing users excluding current user)
  const availableFriends = mockUsers.filter(u => u.id !== currentUser.id);

  // Get friends that are selected or added by handle
  const allFriends = useMemo(() => {
    // Get all unique friends (available + highlighted)
    const friendMap = new Map<string, User>();
    
    // Add all available friends
    availableFriends.forEach(friend => {
      friendMap.set(friend.id, friend);
    });
    
    // Add highlighted friends (those added by handle)
    highlightedFriendIds.forEach(friendId => {
      const friend = mockUsers.find(u => u.id === friendId && u.id !== currentUser.id);
      if (friend) {
        friendMap.set(friend.id, friend);
      }
    });
    
    return Array.from(friendMap.values());
  }, [availableFriends, highlightedFriendIds]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddFriendByHandle = () => {
    if (!friendHandle.trim()) {
      toast.error('Please enter a handle');
      return;
    }

    // Validate handle format
    const handleValidation = validateHandleFormat(friendHandle);
    if (!handleValidation.isValid) {
      toast.error(handleValidation.error || 'Invalid handle format');
      return;
    }

    // Find user by handle
    const user = findUserByIdentifier(friendHandle);
    if (!user) {
      toast.error('User not found', {
        description: 'No user with this handle exists in the system'
      });
      return;
    }

    if (user.id === currentUser.id) {
      toast.error('Cannot add yourself', {
        description: 'You are already the project owner'
      });
      return;
    }

    // Add to highlighted friends (so they appear in the list with highlighting)
    setHighlightedFriendIds(prev => new Set([...prev, user.id]));
    
    // Add to selected participants if not already selected
    if (!selectedParticipants.includes(user.id)) {
      setSelectedParticipants(prev => [...prev, user.id]);
      toast.success('Friend added!', {
        description: `${user.name} (${user.handle}) has been added`
      });
    } else {
      toast.info('Friend already added', {
        description: `${user.name} is already in the list`
      });
    }

    // Clear handle input
    setFriendHandle('');
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
    setFriendHandle('');
    setHighlightedFriendIds(new Set());
    onOpenChange(false);
  };

  // Reset form when dialog closes
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setName('');
      setDescription('');
      setSelectedParticipants([]);
      setSelectedColor(PROJECT_COLORS[0].value);
      setIsPublic(true);
      setFriendHandle('');
      setHighlightedFriendIds(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
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
            <Label>Add Friends {!isPublic && '*'}</Label>
            <p className="text-xs text-muted-foreground">
              {isPublic 
                ? 'Optional: Add friends to collaborate (or add them later)'
                : 'Required: Add at least one friend to create a private project'}
            </p>
            
            {/* Add Friend by Handle */}
            <div className="space-y-2">
              <Label htmlFor="friend-handle" className="text-sm">Add Friend by Handle</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="friend-handle"
                    type="text"
                    placeholder="@username"
                    value={friendHandle}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Auto-add @ if user types without it
                      if (value && !value.startsWith('@')) {
                        value = `@${value}`;
                      }
                      setFriendHandle(value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFriendByHandle();
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddFriendByHandle}
                  disabled={!friendHandle.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {/* Friends List */}
            <div className="space-y-2">
              <Label className="text-sm">Select Friends</Label>
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {allFriends.map((user) => {
                  const isSelected = selectedParticipants.includes(user.id);
                  const isHighlighted = highlightedFriendIds.has(user.id);
                  
                  return (
                    <motion.button
                      key={user.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleParticipant(user.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left relative",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-primary"
                          : isHighlighted
                          ? "border-accent bg-accent/5 shadow-accent/20"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {isHighlighted && !isSelected && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="secondary" className="text-xs">New</Badge>
                        </div>
                      )}
                      <Avatar className="w-10 h-10 ring-2 ring-border">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.handle}</div>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="shrink-0">Selected</Badge>
                      )}
                    </motion.button>
                  );
                })}
              </div>
              {allFriends.length === 0 && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Users className="w-4 h-4" />
                  <span>No friends available. Add friends by handle above!</span>
                </div>
              )}
            </div>
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
              onClick={() => handleDialogClose(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || (!isPublic && selectedParticipants.length === 0)}
              className="flex-1 gradient-primary text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isPublic ? 'Create Public Project' : 'Create Private Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

