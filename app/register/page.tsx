// app/register/page.tsx
'use client';

import { useState } from 'react';
import { auth, db } from '@/app/firebase/config';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('admin@leadtrend.com');
  const [password, setPassword] = useState('Admin123456');
  const [confirmPassword, setConfirmPassword] = useState('Admin123456');
  const [name, setName] = useState('System Administrator');
  const [employeeId, setEmployeeId] = useState('ADMIN001');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create employee document in Firestore
      await setDoc(doc(db, 'employees', user.uid), {
        employeeId: employeeId,
        name: name,
        email: email,
        department: 'Management',
        position: 'System Administrator',
        role: 'ADMIN',
        isActive: true,
        uid: user.uid,
        currentStatus: 'Not Started',
        createdAt: new Date().toISOString(),
      });

      setSuccess('Admin account created successfully! Redirecting to login...');
      
      // Redirect to home page after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Please use a different email or login.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError(`Registration failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px', marginTop: '50px' }}>
      <div className="card">
        <div className="card-header text-white text-center py-4" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}>
          <div className="mb-3">
            <i className="fas fa-chart-line fa-4x"></i>
          </div>
          <h3 className="mb-2">Lead Trend</h3>
          <p className="mb-0">Create Admin Account</p>
        </div>
        <div className="card-body p-4">
          {success && (
            <div className="alert alert-success">
              <i className="fas fa-check-circle me-2"></i>
              {success}
            </div>
          )}
          {error && (
            <div className="alert alert-danger">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Employee ID</label>
              <input
                type="text"
                className="form-control"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <small className="text-muted">Minimum 6 characters</small>
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn w-100 text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner me-2"></span>
                  Creating Account...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus me-2"></i>
                  Create Admin Account
                </>
              )}
            </button>
          </form>
          <div className="text-center mt-3">
            <Link href="/" className="text-decoration-none">
              Already have an account? Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}