import * as Toast from '@radix-ui/react-toast';
import { Cross2Icon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';

interface ToastNotifyProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: 'success' | 'error';
  title: string;
  msg: string;
  duration?: number;
}

export default function ToastNotify({ open, onOpenChange, type, title, msg, duration = 3000 }: ToastNotifyProps) {
  return (
    <Toast.Provider>
      <Toast.Root
        open={open}
        onOpenChange={onOpenChange}
        duration={duration}
        className="fixed bottom-6 right-6 z-[9999] flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-xl border border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md animate-slide-up min-w-[280px] max-w-[400px]"
      >
        <span className={`flex-shrink-0 mt-0.5 ${type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
          {type === 'success' ? <CheckCircledIcon className="w-5 h-5" /> : <CrossCircledIcon className="w-5 h-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <Toast.Title className="font-semibold text-sm text-slate-900 dark:text-white">
            {title}
          </Toast.Title>
          <Toast.Description className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
            {msg}
          </Toast.Description>
        </div>
        <Toast.Close className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <Cross2Icon className="w-4 h-4" />
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  );
}
