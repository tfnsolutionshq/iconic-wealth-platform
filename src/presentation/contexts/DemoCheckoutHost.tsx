import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import type { ContributionIntent } from '@/domain/repositories';
import type { DemoOutcome } from '@/data/gateways';
import { formatNaira } from '@/domain/rules';
import { Button, Modal } from '../design-system';
import { useServices } from './ServicesContext';

/** DEMO ONLY: stands in for Paystack so presenters can choose the outcome. Not rendered when VITE_DEMO_MODE=false. */
export function DemoCheckoutHost() {
  const { demoGateway } = useServices();
  const [pending, setPending] = useState<{ intent: ContributionIntent; resolve: (o: DemoOutcome) => void } | null>(null);
  useEffect(() => { demoGateway?.setPicker(intent => new Promise(resolve => setPending({ intent, resolve }))); }, [demoGateway]);
  if (!demoGateway || !pending) return null;
  const done = (o: DemoOutcome) => { pending.resolve(o); setPending(null); };
  const { intent } = pending; const total = intent.amountKobo + intent.platformChargeKobo;
  return <Modal open title="Paystack checkout (demo stand-in)" onClose={() => done('Pending')}
    footer={<><Button variant="outline" size="md" onClick={() => done('Pending')}>Close before confirmation</Button><Button variant="outline" size="md" onClick={() => done('Failed')}>Payment fails</Button><Button size="md" onClick={() => done('Successful')}>Payment succeeds</Button></>}>
    <div className="flex flex-col items-center gap-1 rounded-card bg-soft p-6 text-center"><Lock size={24} /><b className="mt-1">{formatNaira(total)}</b>
      <span className="text-sm text-mute">{formatNaira(intent.amountKobo)} saved + {formatNaira(intent.platformChargeKobo)} platform charge · {intent.reference}</span></div>
    <p className="text-[13px] font-semibold text-mute">Demo mode. In production Paystack’s own checkout opens here and our server verifies the result.</p>
  </Modal>;
}
