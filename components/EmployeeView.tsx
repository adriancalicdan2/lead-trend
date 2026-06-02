'use client';

import { useAuth } from '@/contexts/AuthContext';
import { timeTrackerService } from '@/services/timeTrackerService';
import { useState, useEffect } from 'react';
import { TimeLog } from '@/types';

export default function EmployeeView() {
  const { employee } = useAuth();
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<TimeLog[]>([]);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [clockMessage, setClockMessage] = useState('');
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);

  const TARGET_HOURS = 10;

  useEffect(() => {
    if (employee) {
      initializeData();
    }
    
    const updateClock = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setCurrentDate(now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    
    return () => clearInterval(interval);
  }, [employee]);

  useEffect(() => {
    let durationInterval: NodeJS.Timeout;
    
    if (todayLog && todayLog.status === 'Clocked In' && todayLog.clockIn) {
      durationInterval = setInterval(() => {
        const clockInTime = todayLog.clockIn?.toDate();
        if (clockInTime) {
          const now = new Date();
          const hours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          setCurrentDuration(hours);
        }
      }, 1000);
    }
    
    return () => {
      if (durationInterval) clearInterval(durationInterval);
    };
  }, [todayLog]);

  const initializeData = async () => {
    if (!employee) return;
    setLoading(true);
    
    try {
      await loadTodayLog();
      await loadRecentLogs();
      await loadStats();
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayLog = async () => {
    if (!employee) return;
    const log = await timeTrackerService.getTodayTimeLog(employee.employeeId);
    setTodayLog(log);
    
    if (log && log.status === 'Clocked In' && log.clockIn) {
      const clockInTime = log.clockIn?.toDate();
      if (clockInTime) {
        const hours = (new Date().getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        setCurrentDuration(hours);
      }
    } else {
      setCurrentDuration(0);
    }
  };

  const loadRecentLogs = async () => {
    if (!employee) return;
    const logs = await timeTrackerService.getEmployeeTimeLogs(employee.employeeId, 10);
    setRecentLogs(logs);
  };

  const loadStats = async () => {
    if (!employee) return;
    const stats = await timeTrackerService.getEmployeeStats(employee.employeeId);
    setWeeklyHours(stats.weeklyHours);
    setMonthlyHours(stats.monthlyHours);
  };

  const handleClockIn = async () => {
    if (!employee) return;
    
    try {
      const result = await timeTrackerService.clockIn(employee);
      setClockMessage(`Clocked in successfully at ${result.roundedTime}`);
      await loadTodayLog();
      await loadRecentLogs();
      setTimeout(() => setClockMessage(''), 5000);
    } catch (error: any) {
      setClockMessage(`Error: ${error.message}`);
      setTimeout(() => setClockMessage(''), 5000);
    }
  };

  const showClockOut = () => {
    if (!todayLog) return;
    const clockInTime = todayLog.clockIn?.toDate();
    if (clockInTime) {
      const hours = (new Date().getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      setCurrentDuration(hours);
    }
    setShowClockOutModal(true);
  };

  const handleClockOut = async () => {
    if (!todayLog || !employee) return;
    
    try {
      const result = await timeTrackerService.clockOut(todayLog.id!, employee.id);
      
      let message = `Successfully clocked out! Total hours: ${result.duration.toFixed(2)}`;
      if (result.undertime) {
        message = `Clocked out after ${result.duration.toFixed(2)} hours (Undertime - less than ${TARGET_HOURS} hours).`;
      } else if (result.overtime) {
        message = `Clocked out after ${result.duration.toFixed(2)} hours (Overtime). Thank you!`;
      }
      
      setClockMessage(message);
      setShowClockOutModal(false);
      setClockOutNotes('');
      await loadTodayLog();
      await loadRecentLogs();
      await loadStats();
      setTimeout(() => setClockMessage(''), 5000);
    } catch (error: any) {
      setClockMessage(`Error: ${error.message}`);
      setTimeout(() => setClockMessage(''), 5000);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '--';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      return '--';
    } catch {
      return '--';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '--';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getDurationPercentage = () => Math.min((currentDuration / TARGET_HOURS) * 100, 100);

  const getDurationFillColor = () => {
    if (currentDuration < TARGET_HOURS) return 'linear-gradient(90deg, #F59E0B, #D97706)';
    if (currentDuration > TARGET_HOURS) return 'linear-gradient(90deg, #8B5CF6, #7C3AED)';
    return 'linear-gradient(90deg, #10B981, #059669)';
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="loading-spinner mx-auto mb-3" style={{ width: '40px', height: '40px' }}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className="welcome-card">
        <h4>Time Tracking Dashboard</h4>
        <p className="mb-0">Clock in/out and track your working hours ({TARGET_HOURS} hours target)</p>
      </div>

      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="stats-card">
            <h5><i className="fas fa-user-clock me-2"></i>Current Status</h5>
            <div className={`status-badge ${todayLog?.status === 'Clocked In' ? 'status-in' : 'status-out'} mb-3`}>
              {todayLog?.status === 'Clocked In' ? 'Clocked In' : 'Clocked Out'}
            </div>
            <p className="text-muted">
              {todayLog?.status === 'Clocked In' 
                ? `Clocked in at ${formatTime(todayLog?.clockIn)}`
                : 'Ready to clock in'}
            </p>
            
            <div className="mt-4">
              <p className="mb-1">Today's Duration: <strong>{currentDuration.toFixed(2)} hours</strong></p>
              <div className="duration-bar">
                <div 
                  className="duration-fill" 
                  style={{ width: `${getDurationPercentage()}%`, background: getDurationFillColor() }}
                ></div>
              </div>
              <small className="text-muted">{TARGET_HOURS} hours target ({getDurationPercentage().toFixed(0)}% completed)</small>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="stats-card">
            <h5><i className="fas fa-chart-bar me-2"></i>Quick Stats</h5>
            <div className="row text-center mt-3">
              <div className="col-6">
                <h3 style={{ color: 'var(--primary)' }}>{weeklyHours.toFixed(1)}</h3>
                <p className="text-muted mb-0">This Week</p>
              </div>
              <div className="col-6">
                <h3 style={{ color: 'var(--primary)' }}>{monthlyHours.toFixed(1)}</h3>
                <p className="text-muted mb-0">This Month</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="clock-card">
        <div className="clock-time">{liveTime}</div>
        <div className="clock-date">{currentDate}</div>
        
        <div className="clock-buttons">
          <button 
            className="btn btn-clock btn-clock-in" 
            onClick={handleClockIn}
            disabled={todayLog?.status === 'Clocked In'}
          >
            <i className="fas fa-sign-in-alt me-2"></i>Clock In
          </button>
          <button 
            className="btn btn-clock btn-clock-out" 
            onClick={showClockOut}
            disabled={todayLog?.status !== 'Clocked In'}
          >
            <i className="fas fa-sign-out-alt me-2"></i>Clock Out
          </button>
        </div>
        
        {clockMessage && (
          <div className="alert alert-info mt-3">{clockMessage}</div>
        )}
      </div>

      <div className="card mt-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><i className="fas fa-history me-2"></i>Recent Time Logs</h5>
          <button className="btn btn-sm btn-outline-primary" onClick={loadRecentLogs}>
            <i className="fas fa-sync"></i>
          </button>
        </div>
        <div className="card-body">
          {recentLogs.length === 0 ? (
            <div className="text-center py-4">
              <i className="fas fa-history fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">No Time Logs Found</h5>
              <p className="text-muted">Your time logs will appear here after clocking in/out.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.date)}</td>
                      <td>{log.roundedClockIn || formatTime(log.clockIn)}</td>
                      <td>{log.roundedClockOut || formatTime(log.clockOut)}</td>
                      <td>{log.duration ? `${log.duration.toFixed(2)} hours` : '--'}</td>
                      <td>
                        <span className={`status-badge ${log.status === 'Clocked In' ? 'status-in' : 'status-out'}`}>
                          {log.status}
                        </span>
                        {log.undertime && <span className="badge bg-warning ms-1">Undertime</span>}
                        {log.overtime && <span className="badge bg-purple ms-1 text-white">Overtime</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showClockOutModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-exclamation-triangle me-2 text-warning"></i>
                  Clock Out Confirmation
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowClockOutModal(false)}></button>
              </div>
              <div className="modal-body">
                {currentDuration < TARGET_HOURS ? (
                  <div className="alert alert-warning">
                    <h6><i className="fas fa-exclamation-circle me-2"></i>Undertime Notice</h6>
                    <p>You are clocking out after only <strong>{currentDuration.toFixed(2)} hours</strong>. Normal working hours are <strong>{TARGET_HOURS} hours</strong>.</p>
                    <p className="mb-2"><strong>Are you sure you want to clock out?</strong></p>
                  </div>
                ) : (
                  <div>
                    <p>You have worked <strong>{currentDuration.toFixed(2)} hours</strong> today.</p>
                    <p className="mb-2"><strong>Proceed with clock out?</strong></p>
                  </div>
                )}
                <div className="mt-3">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea 
                    className="form-control" 
                    rows={2} 
                    placeholder="Add any notes about your shift..."
                    value={clockOutNotes}
                    onChange={(e) => setClockOutNotes(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowClockOutModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-warning" onClick={handleClockOut}>
                  <i className="fas fa-sign-out-alt me-1"></i>Confirm Clock Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}