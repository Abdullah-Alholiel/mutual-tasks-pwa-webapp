import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

interface CustomToastProps {
  id?: string | number;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
}

/**
 * Toast type → CSS class mapping.
 * Colors are defined in index.css using the global palette variables.
 */
const typeClass: Record<string, string> = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export const CustomToast = ({ id, title, description, type = 'info', action }: CustomToastProps) => {
  const IconComponent = icons[type];
  const cls = typeClass[type] ?? typeClass.info;

  return (
    <div
      className={`custom-toast-content ${cls}`}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Icon — 30px circle */}
      <div className="toast-icon-circle">
        <IconComponent style={{ width: '15px', height: '15px', color: '#fff', strokeWidth: 2.5 }} />
      </div>

      {/* Text — fills remaining space */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          minWidth: 0,
        }}
      >
        <p className="toast-title">
          {title}
        </p>
        {description && (
          <p className="custom-toast-description">
            {description}
          </p>
        )}
      </div>

      {/* Action button — inline in flow */}
      {action && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
            sonnerToast.dismiss(id);
          }}
          className="toast-action-btn"
        >
          {action.label}
        </button>
      )}

      {/* Close X — always last in the flex row, never overlaps anything */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          sonnerToast.dismiss(id);
        }}
        aria-label="Close toast"
        className="custom-toast-close"
      >
        <X style={{ width: '14px', height: '14px', strokeWidth: 2 }} />
      </button>
    </div>
  );
};
