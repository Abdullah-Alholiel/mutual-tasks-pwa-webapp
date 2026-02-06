import type { NotificationType } from '@/types';

interface MessageData {
    userName?: string;
    taskTitle?: string;
    projectName?: string;
    role?: string;
    streakCount?: number;
    count?: number;
}

export const getNotificationMessage = (type: NotificationType, data: MessageData): string => {
    const { userName, taskTitle, projectName, role, streakCount, count } = data;

    switch (type) {
        case 'task_created':
            return `New mission: ${userName} just dropped "${taskTitle}" in ${projectName}. Let's get it! 🚀`;

        case 'task_completed':
            return `Victory! ${userName} just crushed "${taskTitle}". Great work everyone! ✨`;

        case 'task_recovered':
            return `Back from the archives: ${userName} brought back "${taskTitle}". Let's finish what we started.`;

        case 'task_deleted':
            return `Change of plans: ${userName} removed "${taskTitle}" from ${projectName}.`;

        case 'task_updated':
            return `Quick update: ${userName} tweaked "${taskTitle}" in ${projectName}.`;

        case 'task_overdue':
            return `Time's ticking! "${taskTitle}" is now overdue. Let's knock it out! ⏰`;

        case 'project_joined':
            if (count && count > 1) {
                return `The squad is growing! ${count} new members just joined ${projectName}.`;
            }
            return `${userName} is now part of the team! They just joined ${projectName}. Welcome!`;

        case 'role_changed':
            return `New responsibilities: ${userName} is now a ${role} in ${projectName}.`;

        case 'friend_request':
            return `${userName} wants to team up! Check out their friend request.`;

        case 'friend_accepted':
            return `It's official! ${userName} accepted your friend request. Let's get things done. 🤝`;

        case 'project_updated':
            return `A little tweak here: ${userName} updated the details for ${projectName}.`;

        case 'project_created':
            return `A new journey begins: ${userName} created ${projectName}. Let's make it happen! 🌱`;

        case 'project_deleted':
            return `End of the road for ${projectName}. ${userName} has wrapped up this project.`;

        case 'streak_reminder':
            return `Don't break the chain! You're on a ${streakCount} day streak. Keep it going! 🔥`;

        default:
            return 'You have a new notification';
    }
};
