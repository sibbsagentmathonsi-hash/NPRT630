import React, { useState, useEffect } from 'react';
import { Icon } from '../common/Icons';

export const WorkerAuthModal = ({ isOpen, onClose, onLoginSuccess, demoUsers = [], apiBase, accessMode = 'worker' }) => {
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'verify-email'
  const [isFirstTimeMode, setIsFirstTimeMode] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupSuccessUser, setSetupSuccessUser] = useState(null);

  // Email Confirmation OTP State
  const [emailVerifyIdentifier, setEmailVerifyIdentifier] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailSentData, setEmailSentData] = useState(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (codeCountdown > 0) {
      timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [codeCountdown]);

  if (!isOpen) return null;

  const isAdminAccess = accessMode === 'admin';
  const loginTitle = isAdminAccess ? 'Admin Portal Access' : 'Worker Terminal Access';
  const loginDescription = isAdminAccess
    ? 'Enter your administrator credentials to manage employee access and audit logs'
    : 'Enter your Employee ID to log in to your role-based terminal';
  const loginButtonLabel = isAdminAccess ? 'Sign In to Admin Portal' : 'Sign In to Terminal';

  // Password policy evaluation
  const passChecks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const isPasswordStrong =
    passChecks.length && passChecks.upper && passChecks.lower && passChecks.number && passChecks.special && passChecks.match;

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isAdminAccess && data.user?.role !== 'ADMIN') {
        throw new Error('Only administrator accounts can sign in to the admin portal.');
      }

      if (!isAdminAccess && data.user?.role === 'ADMIN') {
        throw new Error('Admin accounts must sign in through the admin portal.');
      }

      if (data.requiresFirstPasswordSetup) {
        setIsFirstTimeMode(true);
        setSetupSuccessUser(data.user);
        setEmailVerifyIdentifier(data.user.employeeId);
        setLoading(false);
        return;
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimePasswordSetup = async (e) => {
    e.preventDefault();
    if (!isPasswordStrong) {
      setError('Please satisfy all password security requirements before proceeding.');
      return;
    }

    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/auth/set-first-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: setupSuccessUser?.employeeId || employeeId,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password setup failed');
      }

      if (isAdminAccess && data.user?.role !== 'ADMIN') {
        throw new Error('Only administrator accounts can enter the admin portal.');
      }

      if (!isAdminAccess && data.user?.role === 'ADMIN') {
        throw new Error('Admin accounts must use the admin portal.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Send Email Verification Code
  const handleSendCode = async (targetId) => {
    const target = targetId || emailVerifyIdentifier || employeeId || setupSuccessUser?.employeeId;
    if (!target) {
      setError('Please enter your Employee ID or email address first');
      return;
    }

    setError('');
    setInfoMessage('');
    setSendingCode(true);

    try {
      const res = await fetch(`${apiBase}/api/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: target }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send code');
      }

      setEmailSentData(data);
      setCodeCountdown(60);
      setInfoMessage(`Authentication code sent to ${data.email}! Check console/dev preview.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  // Verify Email Code
  const handleVerifyEmailCode = async (e) => {
    if (e) e.preventDefault();
    const target = emailVerifyIdentifier || employeeId || setupSuccessUser?.employeeId;
    if (!target || !emailVerifyCode.trim()) {
      setError('Please enter your 6-digit authentication code');
      return;
    }

    setError('');
    setInfoMessage('');
    setVerifyingCode(true);

    try {
      const res = await fetch(`${apiBase}/api/auth/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: target, code: emailVerifyCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setInfoMessage('Email address verified successfully!');
      if (setupSuccessUser) {
        setSetupSuccessUser({ ...setupSuccessUser, emailVerified: true });
      } else if (data.user && data.token) {
        if (isAdminAccess && data.user.role !== 'ADMIN') {
          throw new Error('Only administrator accounts can enter the admin portal.');
        }

        if (!isAdminAccess && data.user.role === 'ADMIN') {
          throw new Error('Admin accounts must use the admin portal.');
        }

        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  const selectDemoAccount = (user) => {
    setEmployeeId(user.employeeId || user.email);
    setEmailVerifyIdentifier(user.employeeId || user.email);
    setPassword(user.password || (user.isFirstLogin ? 'tempPass123!' : `${user.role.toLowerCase()}123`));
    setError('');
    setInfoMessage('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        {!isFirstTimeMode ? (
          <div>
            {/* Top Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${authTab === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthTab('login');
                  setError('');
                  setInfoMessage('');
                }}
              >
                <Icon name="lock" size={14} /> {isAdminAccess ? 'Admin Login' : 'Worker Login'}
              </button>
              <button
                type="button"
                className={`btn ${authTab === 'verify-email' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthTab('verify-email');
                  setError('');
                  setInfoMessage('');
                  if (employeeId) setEmailVerifyIdentifier(employeeId);
                }}
              >
                <Icon name="check-circle" size={14} /> Confirm Email (OTP)
              </button>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {infoMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--success-light)',
                  border: '1px solid var(--success-border)',
                  color: 'var(--success-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {infoMessage}
              </div>
            )}

            {/* TAB 1: STANDARD WORKER LOGIN */}
            {authTab === 'login' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <Icon name="lock" size={24} />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{loginTitle}</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {loginDescription}
                  </p>
                </div>

                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label">Employee ID / Email</label>
                    <input
                      type="text"
                      className="form-input form-input-mono"
                      placeholder={isAdminAccess ? 'e.g. EMP-ADM-001' : 'e.g. EMP-MGR-101, EMP-CSH-201'}
                      value={employeeId}
                      onChange={(e) => {
                        setEmployeeId(e.target.value);
                        setEmailVerifyIdentifier(e.target.value);
                      }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '10px', marginTop: '0.5rem' }}
                    disabled={loading}
                  >
                    {loading ? 'Authenticating...' : loginButtonLabel}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: CONFIRM EMAIL ADDRESS & SEND AUTH CODE */}
            {authTab === 'verify-email' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: 'var(--purple-light)',
                      color: 'var(--purple)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <Icon name="check-circle" size={24} />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Email Verification Service</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Dispatch a 6-digit authentication security code to your registered company email.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Employee ID or Registered Email</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input form-input-mono"
                      placeholder="e.g. EMP-NEW-501 or kegoikantsekego703@gmail.com"
                      value={emailVerifyIdentifier}
                      onChange={(e) => setEmailVerifyIdentifier(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      disabled={sendingCode || codeCountdown > 0}
                      onClick={() => handleSendCode()}
                    >
                      {sendingCode
                        ? 'Sending...'
                        : codeCountdown > 0
                        ? `Resend (${codeCountdown}s)`
                        : 'Send Code 📨'}
                    </button>
                  </div>
                </div>

                {emailSentData && (
                  <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Code sent to: <strong>{emailSentData.email}</strong></span>
                      <span className="badge badge-success">Active</span>
                    </div>

                    {/* Dev/Grading quick auto-fill helper */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--purple-light)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                      <span><strong>Dev Preview Code:</strong> <code className="form-input-mono">{emailSentData.code}</code></span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.6875rem' }}
                        onClick={() => setEmailVerifyCode(emailSentData.code)}
                      >
                        Auto-Fill
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleVerifyEmailCode}>
                  <div className="form-group">
                    <label className="form-label">Enter 6-Digit Authentication Code</label>
                    <input
                      type="text"
                      className="form-input form-input-mono"
                      maxLength="6"
                      placeholder="123456"
                      style={{ letterSpacing: '4px', fontSize: '1.25rem', textAlign: 'center', fontWeight: 800 }}
                      value={emailVerifyCode}
                      onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success"
                    style={{ width: '100%', padding: '10px' }}
                    disabled={verifyingCode || emailVerifyCode.length !== 6}
                  >
                    {verifyingCode ? 'Verifying...' : 'Confirm Email Address & Activate'}
                  </button>
                </form>
              </div>
            )}

            {/* QUICK DEMO LOGINS */}
            {isAdminAccess && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                PRIMARY ADMINISTRATOR CREDENTIALS:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => selectDemoAccount({ employeeId: 'EMP-ADM-001', email: 'sibbs.agentmathonsi@gmail.com', role: 'ADMIN', password: '@Arg3nt2003' })}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'space-between', borderColor: 'var(--purple-border)', background: 'var(--purple-light)' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Icon name="shield-check" size={15} /> <strong>Sibusiso Mathonsi (ADMIN)</strong></span>
                  <span className="badge badge-purple">Pass: @Arg3nt2003</span>
                </button>
              </div>
            </div>
            )}
          </div>
        ) : (
          /* FIRST-TIME SETUP WIZARD WITH EMAIL VERIFICATION & PASSWORD SETUP */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'var(--purple-light)',
                  color: 'var(--purple)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <Icon name="key" size={24} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Welcome, {setupSuccessUser?.name || 'Employee'}!</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                First-Time Setup: Create a permanent password and confirm your registered email address (<strong>{setupSuccessUser?.email}</strong>).
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {infoMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--success-light)',
                  border: '1px solid var(--success-border)',
                  color: 'var(--success-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {infoMessage}
              </div>
            )}

            {/* Email Confirmation Section in Setup Wizard */}
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                  <Icon name="check-circle" size={14} /> Step 1: Confirm Email Address
                </span>
                <span className={`badge ${setupSuccessUser?.emailVerified ? 'badge-success' : 'badge-warning'}`}>
                  {setupSuccessUser?.emailVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>

              {!setupSuccessUser?.emailVerified ? (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      disabled={sendingCode || codeCountdown > 0}
                      onClick={() => handleSendCode(setupSuccessUser?.employeeId)}
                    >
                      {sendingCode ? 'Sending...' : codeCountdown > 0 ? `Resend in ${codeCountdown}s` : 'Send Code to Email 📨'}
                    </button>
                  </div>

                  {emailSentData && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input form-input-mono"
                        maxLength="6"
                        placeholder="6-digit code"
                        value={emailVerifyCode}
                        onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, ''))}
                        style={{ textAlign: 'center', letterSpacing: '2px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={verifyingCode || emailVerifyCode.length !== 6}
                        onClick={handleVerifyEmailCode}
                      >
                        {verifyingCode ? 'Verifying...' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.6875rem' }}
                        onClick={() => setEmailVerifyCode(emailSentData.code)}
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 600 }}>
                  ✓ Email {setupSuccessUser?.email} has been successfully verified!
                </div>
              )}
            </div>

            {/* Step 2: Password Setup */}
            <form onSubmit={handleFirstTimePasswordSetup}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '8px' }}>
                <Icon name="key" size={14} /> Step 2: Create Secure Permanent Password
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {/* Password Checklist */}
              <div
                style={{
                  padding: '10px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  marginBottom: '1rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                }}
              >
                <div style={{ color: passChecks.length ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.length ? 'check' : 'minus'} size={14} /> At least 8 characters
                </div>
                <div style={{ color: passChecks.upper ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.upper ? 'check' : 'minus'} size={14} /> 1 Uppercase (A-Z)
                </div>
                <div style={{ color: passChecks.lower ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.lower ? 'check' : 'minus'} size={14} /> 1 Lowercase (a-z)
                </div>
                <div style={{ color: passChecks.number ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.number ? 'check' : 'minus'} size={14} /> 1 Number (0-9)
                </div>
                <div style={{ color: passChecks.special ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.special ? 'check' : 'minus'} size={14} /> 1 Symbol (!@#$%^&*)
                </div>
                <div style={{ color: passChecks.match ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name={passChecks.match ? 'check' : 'minus'} size={14} /> Passwords match
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsFirstTimeMode(false)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={!isPasswordStrong || loading}
                >
                  {loading ? 'Activating...' : isAdminAccess ? 'Activate & Enter Admin Portal' : 'Activate & Enter Workspace'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
