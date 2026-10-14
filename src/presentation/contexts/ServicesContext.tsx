import { createContext, useContext, type ReactNode } from 'react';
import type { Container } from '@/app/di/container';

const ServicesContext = createContext<Container | null>(null);
export function ServicesProvider({ container, children }: { container: Container; children: ReactNode }) {
  return <ServicesContext.Provider value={container}>{children}</ServicesContext.Provider>;
}
/** Access repositories and the clock. Presentation code never imports data-layer classes directly. */
export function useServices(): Container {
  const c = useContext(ServicesContext);
  if (!c) throw new Error('useServices must be used inside ServicesProvider');
  return c;
}
