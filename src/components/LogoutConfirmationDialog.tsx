import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogOut } from 'lucide-react';

interface LogoutConfirmationDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when the dialog open state changes */
    onOpenChange: (open: boolean) => void;
    /** Callback when logout is confirmed */
    onConfirm: () => void;
    /** Whether the logout action is in progress */
    isLoading?: boolean;
}

/**
 * A reusable confirmation dialog for logout actions.
 * Provides a consistent UX for confirming logout across the application.
 * 
 * @example
 * ```tsx
 * const [showLogoutDialog, setShowLogoutDialog] = useState(false);
 * 
 * <LogoutConfirmationDialog
 *   open={showLogoutDialog}
 *   onOpenChange={setShowLogoutDialog}
 *   onConfirm={handleLogout}
 * />
 * ```
 */
export const LogoutConfirmationDialog = ({
    open,
    onOpenChange,
    onConfirm,
    isLoading = false,
}: LogoutConfirmationDialogProps) => {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                        <LogOut className="w-5 h-5 text-destructive" />
                        Log Out?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="pt-2 text-base">
                        Are you sure you want to log out? You'll need to sign in again to access your account.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 mt-4">
                    <AlertDialogCancel
                        className="rounded-xl"
                        disabled={isLoading}
                    >
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="rounded-xl px-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isLoading ? 'Logging out...' : 'Log Out'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default LogoutConfirmationDialog;
