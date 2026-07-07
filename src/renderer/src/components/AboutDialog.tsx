import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, ExternalLink, GitBranch, Mail, RefreshCw, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Logo } from './Logo';
import { Button } from './ui/Button';
import { ABOUT, type Person } from '@/config/about';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';

function PersonRow({ person }: { person: Person }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {person.name}
        </p>
        {person.role && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{person.role}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {person.email && (
          <a
            href={`mailto:${person.email}`}
            title={person.email}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {person.github && (
          <a
            href={person.github}
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <GitBranch className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function UpdateSection() {
  const { status, check, download, install } = useAutoUpdate();

  if (status.state === 'unsupported') return null;

  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Updates</h3>
      <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
        {status.state === 'checking' ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking for updates…
          </p>
        ) : status.state === 'available' ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Update available: <span className="font-medium">v{status.version}</span>
            </p>
            <Button size="sm" onClick={() => void download()}>
              <Download className="h-3.5 w-3.5" /> Update Now
            </Button>
          </div>
        ) : status.state === 'downloading' ? (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Downloading update… {status.percent}%
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          </div>
        ) : status.state === 'downloaded' ? (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> v{status.version} ready to install
            </p>
            <Button size="sm" variant="primary" onClick={() => void install()}>
              Restart &amp; Install
            </Button>
          </div>
        ) : status.state === 'error' ? (
          <div className="flex items-center justify-between gap-2">
            <p
              className="flex min-w-0 items-center gap-1.5 truncate text-xs text-red-600 dark:text-red-400"
              title={status.message}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Update check failed
            </p>
            <Button size="sm" variant="outline" onClick={() => void check()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {status.state === 'not-available' ? "You're up to date." : 'Check for the latest version.'}
            </p>
            <Button size="sm" variant="outline" onClick={() => void check()}>
              <RefreshCw className="h-3.5 w-3.5" /> Check for Updates
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [version, setVersion] = useState('');
  useEffect(() => {
    void window.api.app.getVersion().then(setVersion);
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="About" className="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5 text-base font-semibold text-slate-800 dark:text-slate-100">
              ApiTab
              <span className="text-xs font-normal text-slate-400">v{version}</span>
            </p>
            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
              {ABOUT.tagline}
            </p>
          </div>
        </div>

        <UpdateSection />

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Developer
          </h3>
          <PersonRow person={ABOUT.developer} />
        </section>

        <section>
          <h3 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-3 w-3" />
            Contributors
          </h3>
          {ABOUT.contributors.length > 0 ? (
            <div className="space-y-1.5">
              {ABOUT.contributors.map((c) => (
                <PersonRow key={c.name} person={c} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contributions welcome —{' '}
              <a
                href={ABOUT.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                open a pull request
              </a>
              .
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Links
          </h3>
          <div className="space-y-1">
            <a
              href={ABOUT.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <GitBranch className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{ABOUT.repoUrl.replace(/^https?:\/\//, '')}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </a>
            {ABOUT.links.slice(1).map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
              </a>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-1.5">
          {ABOUT.techStack.map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400">
          {ABOUT.license} Licensed · Made with ⚡ for developers
        </p>
      </div>
    </Modal>
  );
}
