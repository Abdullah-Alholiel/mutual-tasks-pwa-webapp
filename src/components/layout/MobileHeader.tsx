import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Inbox } from '@/features/notifications/Inbox';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useAuth } from '@/features/auth/useAuth';

export const MobileHeader = () => {
    const { user } = useAuth();

    // Use real-time notifications hook
    const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;
    const { notifications, markAsRead, markAllAsRead, deleteAll, deleteList } = useNotifications({
        userId,
        enabled: !!user,
    });

    const handleMarkAsRead = async (notificationId: number) => {
        await markAsRead(notificationId);
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
    };

    return (
        <div className="md:hidden flex justify-between items-center mb-4 min-h-[40px] px-1">
            <div className="flex items-center">
                <Inbox
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onClearAll={deleteAll}
                    onDeleteList={deleteList}
                />
            </div>
            <ThemeToggle size="compact" />
        </div>
    );
};
