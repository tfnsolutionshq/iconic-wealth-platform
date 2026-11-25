import { useEffect, useState, type ReactNode } from 'react';
import { createContainer } from '../di/container';
import { ServicesProvider } from '@/presentation/contexts/ServicesContext';
import { AuthProvider } from '@/presentation/contexts/AuthContext';
import { ToastProvider } from '@/presentation/contexts/ToastContext';
import { DemoCheckoutHost } from '@/presentation/contexts/DemoCheckoutHost';

export function AppProviders({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState(createContainer);

  useEffect(() => {
    if (!import.meta.hot) return;
    // Vite can keep the memoized container instance across HMR updates, leaving
    // repository objects without methods added in the latest module version.
    const refreshContainer = () => setContainer(createContainer());
    import.meta.hot.on('vite:afterUpdate', refreshContainer);
    return () => {
      import.meta.hot?.off('vite:afterUpdate', refreshContainer);
    };
  }, []);

  return <ServicesProvider container={container}><ToastProvider><AuthProvider>{children}<DemoCheckoutHost /></AuthProvider></ToastProvider></ServicesProvider>;
}
