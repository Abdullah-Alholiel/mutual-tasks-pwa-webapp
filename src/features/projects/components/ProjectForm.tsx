import { useState, useMemo, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Project, User } from '@/types';
import { motion } from 'framer-motion';
import { FolderKanban, Sparkles, Globe, Lock, AtSign, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adjustColorOpacity } from '@/lib/colorUtils';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { findUserByIdentifier, validateHandleFormat } from '@/lib/userUtils';
import { AIGenerateButton } from '@/components/ui/ai-generate-button';
import { useAIGeneration } from '@/hooks/useAIGeneration';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { FriendSelector } from './FriendSelector';

const PROJECT_COLORS = [
  { name: 'Blue', value: 'hsl(199, 89%, 48%)' },
  { name: 'Green', value: 'hsl(142, 76%, 36%)' },
  { name: 'Orange', value: 'hsl(32, 95%, 58%)' },
  { name: 'Purple', value: 'hsl(280, 70%, 50%)' },
  { name: 'Pink', value: 'hsl(340, 75%, 55%)' },
  { name: 'Teal', value: 'hsl(180, 70%, 45%)' },
];

import { PROJECT_ICONS, ICON_CATEGORIES, getIconsByCategory } from '@/lib/projects/projectIcons';

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (project: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
    icon: string;
  }) => void;
  currentUser: User;
  availableUsers?: User[];
}

export const ProjectForm = ({ open, onOpenChange, onSubmit, currentUser, availableUsers = [] }: ProjectFormProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState(PROJECT_ICONS[0].name);
  const [isPublic, setIsPublic] = useState(true);
  const [friendHandle, setFriendHandle] = useState('');
  const [highlightedFriendIds, setHighlightedFriendIds] = useState<Set<string>>(new Set());
  const [addedUsers, setAddedUsers] = useState<User[]>([]);
  const [iconCategory, setIconCategory] = useState('All');

  // AI Generation Hook
  const { aiState, generateDescription, setAiState } = useAIGeneration('project');

  // Fetch friends from the database
  const { data: userFriends = [] } = useFriends();

  // Get all available friends (existing users excluding current user)
  const availableFriends = availableUsers.filter(u => u.id !== currentUser.id);

  // Get friends that are selected or added by handle
  const allFriends = useMemo(() => {
    // Get all unique friends (available + highlighted + existing friends)
    const friendMap = new Map<string, User>();

    // Add friends from useFriends hook
    userFriends.forEach(f => {
      if (f.friend) {
        friendMap.set(String(f.friend.id), f.friend);
      }
    });

    // Add all available friends (from props)
    availableFriends.forEach(friend => {
      friendMap.set(String(friend.id), friend);
    });

    // Add users that were found by handle search
    addedUsers.forEach(user => {
      if (user.id !== currentUser.id) {
        friendMap.set(String(user.id), user);
      }
    });

    return Array.from(friendMap.values());
  }, [availableFriends, addedUsers, currentUser.id, userFriends]);

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

    // Find user by handle (async search)
    const searchUser = async () => {
      const user = await findUserByIdentifier(friendHandle);
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

      const userIdStr = String(user.id);

      // Add to addedUsers list (so they appear in the grid)
      setAddedUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [...prev, user];
      });
      setHighlightedFriendIds(prev => new Set([...prev, userIdStr]));

      // Add to selected participants if not already selected
      if (!selectedParticipants.includes(userIdStr)) {
        setSelectedParticipants(prev => [...prev, userIdStr]);
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

    searchUser();
  };

  const handleAIGenerate = async () => {
    const desc = await generateDescription(name);
    if (desc) {
      // User requested: "insert the description in project just like task"
      // For task we appended. For project, usually we want a fresh start, but appending is safer.
      // Let's match task behavior: append if exists.
      setDescription((prev) => {
        return prev ? `${prev}\n\n${desc}` : desc;
      });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      participants: selectedParticipants,
      color: selectedColor,
      isPublic,
      icon: selectedIcon
    });

    // Reset form
    setName('');
    setDescription('');
    setSelectedParticipants([]);
    setSelectedColor(PROJECT_COLORS[0].value);
    setSelectedIcon(PROJECT_ICONS[0].name);
    setIsPublic(true);
    setFriendHandle('');
    setHighlightedFriendIds(new Set());
    setIconCategory('All');
    onOpenChange(false);
  };

  // Reset form when dialog closes
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setName('');
      setDescription('');
      setSelectedParticipants([]);
      setSelectedColor(PROJECT_COLORS[0].value);
      setSelectedIcon(PROJECT_ICONS[0].name);
      setIsPublic(true);
      setFriendHandle('');
      setHighlightedFriendIds(new Set());
      setIconCategory('All');
      setAiState('idle'); // Reset AI button
    }
    onOpenChange(open);
  };

  // Get filtered icons based on selected category
  const filteredIcons = getIconsByCategory(iconCategory);

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
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <AIGenerateButton
                state={aiState}
                onClick={handleAIGenerate}
                disabled={!name.trim() || aiState === 'loading'}
                className="scale-90 origin-right"
              />
            </div>
            <Textarea
              id="description"
              placeholder="What's this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          {/* Icon Selection with Category Tabs */}
          <div className="space-y-3">
            <Label>Project Icon</Label>
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {ICON_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setIconCategory(category)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                    iconCategory === category
                      ? "text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                  style={iconCategory === category ? { backgroundColor: selectedColor } : {}}
                >
                  {category}
                </button>
              ))}
            </div>
            {/* Icon Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[140px] overflow-y-auto p-1 custom-scrollbar">
              {filteredIcons.map(({ name: iconName, icon: Icon }) => (
                <motion.button
                  key={iconName}
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedIcon(iconName)}
                  className={cn(
                    "flex items-center justify-center p-2.5 rounded-xl border-2 transition-all aspect-square",
                    selectedIcon === iconName
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-offset-1"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                  style={selectedIcon === iconName ? {
                    color: selectedColor,
                    borderColor: selectedColor,
                    backgroundColor: adjustColorOpacity(selectedColor, 0.15),
                    boxShadow: `0 0 0 2px ${adjustColorOpacity(selectedColor, 0.25)}`
                  } : {}}
                >
                  <Icon className="w-5 h-5" />
                </motion.button>
              ))}
            </div>
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
                  style={selectedColor === color.value ? { borderColor: color.value } : {}}
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

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center" style={isPublic ? { color: selectedColor, backgroundColor: adjustColorOpacity(selectedColor, 0.12) } : {}}>
                {isPublic ? (
                  <Globe className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
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

          {/* Participants */}
          <div className="space-y-2">
            <Label>Add Friends</Label>
            <p className="text-xs text-muted-foreground">
              Optional: Add friends to collaborate (you can always add them later)
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
                    placeholder="username"
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
              <FriendSelector
                availableFriends={allFriends}
                selectedUserIds={selectedParticipants}
                highlightedUserIds={highlightedFriendIds}
                onToggleUser={toggleParticipant}
                selectedColor={selectedColor}
                maxHeight="300px"
                emptyMessage="No friends available. Add friends by handle above!"
              />
            </div>
          </div>

          {/* Info Badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4" style={{ backgroundColor: adjustColorOpacity(selectedColor, 0.03), borderColor: adjustColorOpacity(selectedColor, 0.2) }}>
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
              disabled={!name.trim()}
              className="flex-1 text-white border-0"
              style={{ backgroundColor: selectedColor }}
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

