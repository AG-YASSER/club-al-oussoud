import React from 'react';
import { Trash2, AlertTriangle, HelpCircle, Check, AlertCircle } from 'lucide-react';
import { SupportedLanguage, translations } from '../utils/i18n';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  singleButton?: boolean; // When true, only the confirm/OK button is shown (Alert mode)
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  lang?: SupportedLanguage;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  singleButton = false,
  variant = 'danger',
  onConfirm,
  onCancel,
  onClose,
  lang = 'ar'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const t = translations[lang] || translations.fr;
  const handleDismiss = onCancel || onClose;
  const finalConfirm =
    confirmText ||
    confirmLabel ||
    (singleButton
      ? lang === 'ar'
        ? 'حسناً، فهمت'
        : lang === 'en'
        ? 'OK, Got it'
        : 'D\'accord'
      : lang === 'ar'
      ? 'تأكيد'
      : lang === 'en'
      ? 'Confirm'
      : t.confirmBtn);

  const finalCancel =
    cancelText ||
    cancelLabel ||
    (lang === 'ar' ? 'إلغاء' : lang === 'en' ? 'Cancel' : t.cancelBtn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xs bg-[var(--card-solid)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4 text-center max-h-[90dvh] overflow-y-auto my-auto">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
            variant === 'danger'
              ? 'bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]'
              : variant === 'warning'
              ? 'bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)]'
              : variant === 'success'
              ? 'bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)]'
              : 'bg-[var(--primary-bg)] border border-[var(--primary-border)] text-[var(--primary)]'
          }`}
        >
          {variant === 'danger' ? (
            <Trash2 className="w-6 h-6" />
          ) : variant === 'warning' ? (
            <AlertTriangle className="w-6 h-6" />
          ) : variant === 'success' ? (
            <Check className="w-6 h-6" />
          ) : (
            <AlertCircle className="w-6 h-6" />
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{description}</p>
        </div>

        <div className={singleButton ? 'pt-2' : 'grid grid-cols-2 gap-2 pt-2'}>
          {!singleButton && handleDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-bold transition-all active:scale-95"
            >
              {finalCancel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full py-2.5 rounded-xl text-white text-xs font-bold shadow-lg transition-all active:scale-95 ${
              variant === 'danger'
                ? 'bg-[var(--danger)] hover:opacity-90 shadow-[var(--danger-border)]'
                : variant === 'warning'
                ? 'bg-[var(--warning)] hover:opacity-90 shadow-[var(--warning-border)]'
                : variant === 'success'
                ? 'bg-[var(--success)] hover:opacity-90 shadow-[var(--success-border)]'
                : 'bg-[var(--primary)] hover:opacity-90 shadow-[var(--primary-border)]'
            }`}
          >
            {finalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
