'use client';

import { useAuth } from '@/contexts/AuthContext';
import EmployeeView from './EmployeeView';
import AdminView from './AdminView';
import { useState, useEffect } from 'react';
import Script from 'next/script';

export default function MainApp() {
  const { employee, isAdmin, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" />
      
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}>
        <div className="container">
          <a className="navbar-brand" href="#">
            <i className="fas fa-chart-line me-2"></i>
            <span>Lead Trend</span>
          </a>
          
          <div className="d-flex align-items-center">
            <div className="real-time-clock me-3">{currentTime}</div>
            <span className="navbar-text me-3">Welcome, {employee?.name || 'User'}</span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt me-1"></i>Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        {isAdmin ? <AdminView /> : <EmployeeView />}
      </div>
    </>
  );
}