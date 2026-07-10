import { useEffect, useRef, useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTeamStore } from '@/stores/teamStore';
import { apiClient, ApiError } from '@/services/apiClient';
import { runAllTeamsSync } from '@/services/syncService';
import { toast } from '@/stores/toastStore';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

const titles: Record<Mode, string> = {
  login: 'Log in',
  register: 'Create account',
  forgot: 'Reset password',
  reset: 'Enter reset code',
  verify: 'Verify your email',
};

export function LoginDialog() {
  const open = useDialogStore((s) => s.loginOpen);
  const close = useDialogStore((s) => s.closeLogin);
  const session = useAccountStore((s) => s.session);
  const setSession = useAccountStore((s) => s.setSession);
  const updateUser = useAccountStore((s) => s.updateUser);
  const clearSession = useAccountStore((s) => s.clearSession);
  const setTeams = useTeamStore((s) => s.setTeams);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  // Covers reopening the app (or the dialog store opening this dialog from
  // syncService's startup check) with an already-unverified session, not
  // just the moment right after register/login.
  useEffect(() => {
    if (open && session && !session.user.emailVerified) setMode('verify');
  }, [open, session]);

  const startResendCooldown = () => {
    setResendCooldown(60);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const reset = () => {
    setMode('login');
    setName('');
    setEmail('');
    setPassword('');
    setToken('');
    setNewPassword('');
    setConfirmPassword('');
    setCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    // Unverified accounts can't do anything else in the app anyway — treat
    // dismissing this screen as logging out, rather than leaving a
    // logged-in-but-stuck session with no way back to this screen.
    if (mode === 'verify') clearSession();
    reset();
    close();
  };

  const afterAuthenticated = async () => {
    try {
      const { teams } = await apiClient.fetchTeams();
      setTeams(teams);
      // skipRehydrate: session/teams were just set in-memory above; rehydrating
      // from disk here races their (unawaited) persist writes and can clobber
      // them back to null/[] — see runAllTeamsSync's own doc comment.
      void runAllTeamsSync({ skipRehydrate: true });
    } catch {
      // Non-fatal — teams can be loaded later from the team switcher.
    }
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

      if (!session.user.emailVerified) {
        toast.success(
          mode === 'login' ? 'Logged in' : 'Account created — check your email for a verification code',
        );
        setMode('verify');
        setLoading(false);
        return;
      }

      toast.success(mode === 'login' ? 'Logged in' : 'Account created');
      await afterAuthenticated();
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

  const submitVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const { user } = await apiClient.verifyEmail(code);
      updateUser(user);
      toast.success('Email verified');
      await afterAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await apiClient.resendVerificationEmail();
      toast.success('Verification code sent');
      startResendCooldown();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resend the code.');
    }
  };

  const submit = () => {
    if (mode === 'forgot') return submitForgotPassword();
    if (mode === 'reset') return submitResetPassword();
    if (mode === 'verify') return submitVerify();
    return submitLoginOrRegister();
  };

  const canSubmit = (() => {
    if (loading) return false;
    if (mode === 'forgot') return email.trim() !== '';
    if (mode === 'verify') return code.trim() !== '';
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
          : mode === 'verify'
            ? 'Verify'
            : 'Reset password';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={titles[mode]}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {mode === 'verify' ? 'Log out' : 'Cancel'}
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

        {mode !== 'verify' && (
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
        )}

        {(mode === 'login' || mode === 'register') && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Password
            </span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}

        {mode === 'verify' && (
          <>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Your account isn't active yet. Enter the verification code we emailed you to unlock
              your workspace.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Verification code
              </span>
              <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={resendCooldown > 0}
              className="text-xs font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-brand-400 dark:disabled:text-slate-500"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Didn't get a code? Resend"}
            </button>
          </>
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

        {/* The visible submit button lives in the Modal's footer, outside
            this form's DOM subtree, so it can't be the browser's implicit
            "submit on Enter" target — this invisible button gives it one. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
