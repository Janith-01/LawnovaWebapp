import React, { Fragment, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const Modal = ({ isOpen, onClose, title, children, className, maxWidth = 'max-w-xl' }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Panel */}
            <div
                className={cn(
                    "relative w-full transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl transition-all border border-gray-200 dark:border-slate-800",
                    maxWidth,
                    className
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="flex items-center justify-between mb-6">
                    {title && (
                        <h3
                            id="modal-title"
                            className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                        >
                            {title}
                        </h3>
                    )}
                    <button
                        type="button"
                        className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-2">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
