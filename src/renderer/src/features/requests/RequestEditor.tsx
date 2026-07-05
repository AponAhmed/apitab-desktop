import { useMemo } from 'react';
import { useRequestStore, type RequestTab } from '@/stores/requestStore';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ParamsTab } from './tabs/ParamsTab';
import { HeadersTab } from './tabs/HeadersTab';
import { AuthTab } from './tabs/AuthTab';
import { BodyTab } from './tabs/BodyTab';
import { ScriptsTab } from './tabs/ScriptsTab';

function ActiveDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />;
}

export function RequestEditor() {
  const active = useRequestStore((s) => s.activeRequestTab);
  const setTab = useRequestStore((s) => s.setRequestTab);
  const params = useRequestStore((s) => s.request.params);
  const headers = useRequestStore((s) => s.request.headers);
  const authType = useRequestStore((s) => s.request.auth.type);
  const bodyType = useRequestStore((s) => s.request.body.type);
  const hasScripts = useRequestStore(
    (s) => s.request.scripts.preRequest.trim() !== '' || s.request.scripts.postResponse.trim() !== '',
  );

  const paramCount = useMemo(
    () => params.filter((p) => p.enabled && p.key.trim() !== '').length,
    [params],
  );
  const headerCount = useMemo(
    () => headers.filter((h) => h.enabled && h.key.trim() !== '').length,
    [headers],
  );

  const tabs: TabItem<RequestTab>[] = [
    { id: 'params', label: 'Params', badge: paramCount || undefined },
    { id: 'headers', label: 'Headers', badge: headerCount || undefined },
    {
      id: 'auth',
      label: (
        <span className="flex items-center gap-1.5">Auth {authType !== 'none' && <ActiveDot />}</span>
      ),
    },
    {
      id: 'body',
      label: (
        <span className="flex items-center gap-1.5">Body {bodyType !== 'none' && <ActiveDot />}</span>
      ),
    },
    {
      id: 'scripts',
      label: (
        <span className="flex items-center gap-1.5">Scripts {hasScripts && <ActiveDot />}</span>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs tabs={tabs} active={active} onChange={setTab} className="px-2" />
      <div className="min-h-0 flex-1 overflow-auto">
        {active === 'params' && <ParamsTab />}
        {active === 'headers' && <HeadersTab />}
        {active === 'auth' && <AuthTab />}
        {active === 'body' && <BodyTab />}
        {active === 'scripts' && <ScriptsTab />}
      </div>
    </div>
  );
}
