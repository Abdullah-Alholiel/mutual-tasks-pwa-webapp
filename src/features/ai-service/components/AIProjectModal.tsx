// ============================================================================
// AI Project Modal - Modal for AI-Powered Project Generation
// ============================================================================

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AIGenerateButton } from '@/components/ui/ai-generate-button';
import { Sparkles, CheckCircle2, Calendar, RotateCcw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIconByName } from '@/lib/projects/projectIcons';
import { useAIProjectGeneration } from '../hooks';
import type { AIGeneratedProject, AIGeneratedTask } from '../types';

// ============================================================================
// Types
// ============================================================================

interface AIProjectModalProps {
    /** Whether the modal is open */
    open: boolean;
    /** Callback when the modal open state changes */
    onOpenChange: (open: boolean) => void;
    /** Callback when user confirms project creation */
    onCreateProject: (project: AIGeneratedProject) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog for AI-powered project generation.
 * 
 * Allows users to describe a project in natural language and
 * generates a complete project structure with tasks.
 */
export const AIProjectModal = ({
    open,
    onOpenChange,
    onCreateProject,
}: AIProjectModalProps) => {
    const [description, setDescription] = useState('');
    const { aiState, generatedProject, generateProject, resetState, confirmProjectCreation } = useAIProjectGeneration();

    /**
     * Handle the generate button click
     */
    const handleGenerate = async () => {
        await generateProject(description);
    };

    /**
     * Handle project creation confirmation
     */
    const handleCreate = async () => {
        if (generatedProject) {
            // Increment usage count ONLY when user confirms project creation
            // Block project creation if usage logging fails (to enforce 3/day limit)
            const usageConfirmed = await confirmProjectCreation();
            if (!usageConfirmed) {
                // Don't proceed with project creation if we couldn't log usage
                // This ensures the 3/day limit is enforced
                return;
            }
            onCreateProject(generatedProject);
            handleClose();
        }
    };

    /**
     * Reset and close the modal
     */
    const handleClose = () => {
        setDescription('');
        resetState();
        onOpenChange(false);
    };

    /**
     * Start over with a new description
     */
    const handleStartOver = () => {
        setDescription('');
        resetState();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <DialogTitle>AI Project Generator</DialogTitle>
                    </div>
                    <DialogDescription>
                        Describe your project idea and I'll create it with tasks for you!
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <AnimatePresence mode="wait">
                        {!generatedProject ? (
                            // Input Phase
                            <motion.div
                                key="input"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                {/* Instructions */}
                                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                                    <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">Example:</span>{' '}
                                        "A 30-day fitness challenge with daily workouts, weekly progress checks, and rest days on weekends."
                                    </p>
                                </div>

                                {/* Description Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="ai-description">Project Description</Label>
                                    <Textarea
                                        id="ai-description"
                                        placeholder="Describe your project idea..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="min-h-[120px] text-base resize-none"
                                        disabled={aiState === 'loading'}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Be as detailed as you like - include timeline, frequency, and specific tasks.
                                    </p>
                                </div>

                                {/* Generate Button */}
                                <div className="flex justify-end">
                                    <AIGenerateButton
                                        state={aiState}
                                        onClick={handleGenerate}
                                        disabled={!description.trim() || aiState === 'loading'}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            // Preview Phase
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                {/* Project Preview Header */}
                                <ProjectPreviewCard project={generatedProject} />

                                {/* Tasks Preview */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span>Tasks ({generatedProject.tasks.length})</span>
                                        <Badge variant="secondary" className="text-xs">
                                            AI Generated
                                        </Badge>
                                    </Label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                        {generatedProject.tasks.map((task, index) => (
                                            <TaskPreviewCard key={index} task={task} index={index} />
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleStartOver}
                                        className="flex-1"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Start Over
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleCreate}
                                        className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Create Project
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Preview card for the generated project
 */
const ProjectPreviewCard = ({ project }: { project: AIGeneratedProject }) => {
    const IconComponent = getIconByName(project.icon);

    return (
        <div
            className="p-4 rounded-xl border-2"
            style={{
                borderColor: project.color,
                backgroundColor: `${project.color}10`,
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: project.color }}
                >
                    <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{project.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge
                            variant="outline"
                            style={{ borderColor: project.color, color: project.color }}
                        >
                            {project.isPublic ? 'Public' : 'Private'}
                        </Badge>
                        <Badge variant="secondary">
                            {project.tasks.length} tasks
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Preview card for a generated task
 */
const TaskPreviewCard = ({ task, index }: { task: AIGeneratedTask; index: number }) => {
    const getDueDateText = (daysFromNow: number): string => {
        if (daysFromNow === 0) return 'Today';
        if (daysFromNow === 1) return 'Tomorrow';
        if (daysFromNow <= 7) return `In ${daysFromNow} days`;
        if (daysFromNow <= 14) return 'Next week';
        return `In ${Math.ceil(daysFromNow / 7)} weeks`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
        >
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{task.title}</p>
                {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {task.description}
                    </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {getDueDateText(task.daysFromNow)}
                    </span>
                    {task.type === 'habit' && (
                        <Badge variant="outline" className="text-xs py-0 h-5">
                            {task.recurrencePattern === 'Daily' ? 'Daily' :
                                task.recurrencePattern === 'weekly' ? 'Weekly' :
                                    `Every ${task.recurrenceInterval} days`}
                        </Badge>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

AIProjectModal.displayName = 'AIProjectModal';
