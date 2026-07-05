import { useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { apiClient, ApiError } from '@/services/apiClient';
import { runAllTeamsSync } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const titles: Record<Mode, string> = {
  login: 'Log in',
  register: 'Create account',
  forgot: 'Reset password',
  reset: 'Enter reset code',
};

export function LoginDialog() {
  const open = useDialogStore((s) => s.loginOpen);
  const close = useDialogStore((s) => s.closeLogin);
  const setSession = useAccountStore((s) => s.setSession);
  const setTeams = useTeamStore((s) => s.setTeams);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setMode('login');
    setName('');
    setEmail('');
    setPassword('');
    setToken('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    close();
  };

  const submitLoginOrRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === 'login'
          ? await apiClient.login(email, password)
          : await apiClient.register(name, email, password);

      setSession(session);
      toast.success(mode === 'login' ? 'Logged in' : 'Account created');

      try {
        const { teams } = await apiClient.fetchTeams();
        setTeams(teams);
        void runAllTeamsSync();
      } catch {
        // Non-fatal — teams can be loaded later from the team switcher.
      }

      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.forgotPassword(email);
      toast.success('If that email is registered, a reset code was sent to it.');
      setMode('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.resetPassword(email, token, newPassword, confirmPassword);
      toast.success('Password reset — please log in.');
      setMode('login');
      setPassword('');
      setToken('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (mode === 'forgot') return submitForgotPassword();
    if (mode === 'reset') return submitResetPassword();
    return submitLoginOrRegister();
  };

  const canSubmit = (() => {
    if (loading) return false;
    if (mode === 'forgot') return email.trim() !== '';
    if (mode === 'reset') {
      return (
        email.trim() !== '' &&
        token.trim() !== '' &&
        newPassword.trim() !== '' &&
        confirmPassword.trim() !== ''
      );
    }
    return email.trim() !== '' && password.trim() !== '' && (mode === 'login' || name.trim() !== '');
  })();

  const submitLabel = loading
    ? 'Please wait…'
    : mode === 'login'
      ? 'Log in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Send reset code'
          : 'Reset password';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={titles[mode]}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
      >
        {mode === 'register' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Name
            </span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Email
          </span>
          <Input
            type="email"
            autoFocus={mode === 'login' || mode === 'forgot'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={mode === 'reset'}
          />
        </label>

        {(mode === 'login' || mode === 'register') && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Password
            </span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}

        {mode === 'reset' && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Reset code
              </span>
              <Input autoFocus value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                New password
              </span>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Confirm new password
              </span>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {mode === 'login' && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Don't have an account? Create one
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
              }}
              className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
            >
              Forgot password?
            </button>
          </div>
        )}

        {mode === 'register' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Already have an account? Log in
          </button>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Back to log in
          </button>
        )}
      </form>
    </Modal>
  );
}
