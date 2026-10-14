import { useMemo, type ReactNode } from 'react';
import { createContainer } from '../di/container';
import { ServicesProvider } from '@/presentation/contexts/ServicesContext';
import { AuthProvider } from '@/presentation/contexts/AuthContext';
import { ToastProvider } from '@/presentation/contexts/ToastContext';
import { DemoCheckoutHost } from '@/presentation/contexts/DemoCheckoutHost';

export function AppProviders({ children }: { children: ReactNode }) {
  const container = useMemo(createContainer, []);
  return <ServicesProvider container={container}><ToastProvider><AuthProvider>{children}<DemoCheckoutHost /></AuthProvider></ToastProvider></ServicesProvider>;
}
