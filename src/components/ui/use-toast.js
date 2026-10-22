import { toast as sonnerToast } from 'sonner';
export function toast({ title, description } = {}) { return sonnerToast(title, { description }); }
export const useToast = () => ({ toast });
