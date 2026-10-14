import { useLocation, useParams } from "react-router-dom";
import { Hammer } from "lucide-react";
import { SCREENS } from "../routes/screens";
import { OpenDecisionTag } from "../design-system";
import { AdminPageHeader } from "../layouts/AdminLayout";

/**
 * Placeholder for screens still to be built. Shows the developer exactly what to build:
 * PRD requirement IDs, the reference-build route and notes. Replace with the real page component.
 */
export function ScaffoldPage({ path }: { path: string }) {
  const s = SCREENS.find((x) => x.path === path)!;
  const params = useParams();
  const loc = useLocation();
  const body = (
    <div className="mx-auto my-10 flex max-w-180 flex-col gap-4 rounded-card border-2 border-dashed border-line bg-white p-8">
      <span className="flex items-center gap-2 text-sm font-extrabold text-brand-dark">
        <Hammer size={18} />
        Scaffolded screen · ready to build
      </span>
      <h1 className="font-display text-4xl">{s.title}</h1>
      <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
        <dt className="font-bold text-mute">Route</dt>
        <dd className="font-mono">{loc.pathname}</dd>
        <dt className="font-bold text-mute">Requirements</dt>
        <dd>{s.prd} (Master PRD/BRD v4.0)</dd>
        <dt className="font-bold text-mute">Design reference</dt>
        <dd className="font-mono">iconic-wealth-hub.html{s.ref}</dd>
        {Object.keys(params).length > 0 && (
          <>
            <dt className="font-bold text-mute">Params</dt>
            <dd className="font-mono">{JSON.stringify(params)}</dd>
          </>
        )}
        {s.notes && (
          <>
            <dt className="font-bold text-mute">Notes</dt>
            <dd>{s.notes}</dd>
          </>
        )}
      </dl>
      <OpenDecisionTag code="HANDOVER">
        Build from the reference build and UAT scripts
      </OpenDecisionTag>
    </div>
  );
  return s.area === "admin" ? (
    <>
      <AdminPageHeader title={s.title} sub="Scaffolded" />
      {body}
    </>
  ) : (
    <div className="px-5">{body}</div>
  );
}
