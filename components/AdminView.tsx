'use client';

import { timeTrackerService } from '@/services/timeTrackerService';
import { useState, useEffect } from 'react';
import { Employee, TimeLog } from '@/types';
import { db } from '@/app/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function AdminView() {
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<TimeLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [employeePage, setEmployeePage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [employeesPerPage] = useState(10);
  const [logsPerPage] = useState(10);
  
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [addError, setAddError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [editError, setEditError] = useState('');

  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsSuccess, setSheetsSuccess] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    employeeId: '',
    name: '',
    department: '',
    position: '',
    role: '',
    isActive: true,
    password: '',
  });

  const [newEmployee, setNewEmployee] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    position: '',
    role: 'Employee',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadData();
    loadGoogleSheetsSettings();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, employeeSearch]);

  useEffect(() => {
    filterLogs();
  }, [timeLogs, startDate, endDate, employeeFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadActiveEmployees(),
        loadAllEmployees(),
        loadAllTimeLogs(),
      ]);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveEmployees = async () => {
    try {
      const active = await timeTrackerService.getActiveEmployees();
      setActiveEmployees(active || []);
    } catch (err) {
      console.error('Error loading active employees:', err);
      setActiveEmployees([]);
    }
  };

  const loadAllEmployees = async () => {
    try {
      const allEmployees = await timeTrackerService.getAllEmployees();
      setEmployees(allEmployees || []);
      setFilteredEmployees(allEmployees || []);
    } catch (err) {
      console.error('Error loading employees:', err);
      setEmployees([]);
      setFilteredEmployees([]);
    }
  };

  const loadAllTimeLogs = async () => {
    try {
      const logs = await timeTrackerService.getAllTimeLogs();
      setTimeLogs(logs || []);
      setFilteredLogs(logs || []);
    } catch (err) {
      console.error('Error loading time logs:', err);
      setTimeLogs([]);
      setFilteredLogs([]);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];
    if (employeeSearch) {
      filtered = filtered.filter(emp => 
        emp.name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.email?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.department?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.position?.toLowerCase().includes(employeeSearch.toLowerCase())
      );
    }
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    setFilteredEmployees(filtered);
    setEmployeePage(1);
  };

  const filterLogs = () => {
    let filtered = [...timeLogs];
    
    if (startDate && endDate) {
      filtered = filtered.filter(log => log.date >= startDate && log.date <= endDate);
    }
    
    if (employeeFilter) {
      filtered = filtered.filter(log => 
        log.employeeName?.toLowerCase().includes(employeeFilter.toLowerCase()) ||
        log.employeeId?.toLowerCase().includes(employeeFilter.toLowerCase())
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(log => log.status === statusFilter);
    }
    
    filtered.sort((a, b) => {
      const dateA = a.clockIn?.toDate ? a.clockIn.toDate() : new Date(0);
      const dateB = b.clockIn?.toDate ? b.clockIn.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    setFilteredLogs(filtered);
    setLogPage(1);
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.employeeId || !newEmployee.name || !newEmployee.email || 
        !newEmployee.department || !newEmployee.position || !newEmployee.password) {
      setAddError('All fields are required');
      return;
    }
    
    if (newEmployee.password !== newEmployee.confirmPassword) {
      setAddError('Passwords do not match');
      return;
    }
    
    if (newEmployee.password.length < 6) {
      setAddError('Password must be at least 6 characters');
      return;
    }
    
    try {
      const employeeData = {
        employeeId: newEmployee.employeeId,
        name: newEmployee.name,
        email: newEmployee.email,
        department: newEmployee.department,
        position: newEmployee.position,
        role: newEmployee.role,
        isActive: true,
      };
      
      await timeTrackerService.addEmployee(employeeData, newEmployee.password);
      
      setShowAddModal(false);
      setNewEmployee({
        employeeId: '',
        name: '',
        email: '',
        department: '',
        position: '',
        role: 'Employee',
        password: '',
        confirmPassword: '',
      });
      setAddError('');
      await loadAllEmployees();
    } catch (error: any) {
      setAddError(error.message);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    
    try {
      await timeTrackerService.deleteEmployee(employeeToDelete.id);
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      await loadAllEmployees();
      await loadActiveEmployees();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEditClick = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setEditEmployeeForm({
      employeeId: employee.employeeId || '',
      name: employee.name || '',
      department: employee.department || '',
      position: employee.position || '',
      role: employee.role || 'Employee',
      isActive: employee.isActive ?? true,
      password: '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!employeeToEdit) return;
    if (!editEmployeeForm.employeeId || !editEmployeeForm.name || 
        !editEmployeeForm.department || !editEmployeeForm.position) {
      setEditError('All fields except Role and Password are required');
      return;
    }
    
    try {
      // 1. Update Firestore profile details
      const basicData = {
        employeeId: editEmployeeForm.employeeId,
        name: editEmployeeForm.name,
        department: editEmployeeForm.department,
        position: editEmployeeForm.position,
        role: editEmployeeForm.role,
        isActive: editEmployeeForm.isActive,
      };
      await timeTrackerService.updateEmployee(employeeToEdit.id, basicData);

      // 2. If a new password was typed, update it via Server Action
      if (editEmployeeForm.password) {
        if (editEmployeeForm.password.length < 6) {
          setEditError('New password must be at least 6 characters');
          return;
        }
        
        const { updateEmployeePassword } = await import('@/app/actions/adminActions');
        const res = await updateEmployeePassword(employeeToEdit.uid || employeeToEdit.id, editEmployeeForm.password);
        if (!res.success) {
          setEditError(`Profile updated, but password failed: ${res.error}`);
          return;
        }
      }

      setShowEditModal(false);
      setEmployeeToEdit(null);
      setEditError('');
      await loadAllEmployees();
      await loadActiveEmployees();
    } catch (error: any) {
      setEditError(error.message);
    }
  };

  const exportToCSV = async (customStartDate?: string | null, customEndDate?: string | null) => {
    try {
      const start = customStartDate !== undefined ? customStartDate : (startDate || null);
      const end = customEndDate !== undefined ? customEndDate : (endDate || null);
      
      const data = await timeTrackerService.exportTimeLogsToExcel(start, end);
      
      if (!data || data.length === 0) {
        alert('No time logs to export');
        return;
      }
      
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header as keyof typeof row];
          return `"${String(value || '').replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }
      
      // Add UTF-8 BOM (\ufeff) and join using CRLF (\r\n) for native Excel table parsing
      const blob = new Blob(["\ufeff" + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename = 'Lead_Trend_Time_Logs';
      if (start && end) {
        filename += `_${start}_to_${end}`;
      } else if (start) {
        filename += `_from_${start}`;
      } else if (end) {
        filename += `_until_${end}`;
      } else {
        filename += `_${new Date().toISOString().split('T')[0]}`;
      }
      a.download = `${filename}.csv`;
      
      a.click();
      URL.revokeObjectURL(url);
      
      // Close the modal
      setShowExportModal(false);
    } catch (error: any) {
      alert(`Failed to export: ${error.message}`);
    }
  };

  const loadGoogleSheetsSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'googleSheets');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGoogleSpreadsheetId(docSnap.data().spreadsheetId || '');
      }
    } catch (err) {
      console.error('Failed to load Google Sheets settings:', err);
    }
  };

  const handleSaveSheetsAndSync = async () => {
    if (!googleSpreadsheetId.trim()) {
      setSheetsError('Please enter a valid Google Spreadsheet ID.');
      return;
    }

    setSheetsLoading(true);
    setSheetsError(null);
    setSheetsSuccess(false);

    try {
      // 1. Save Spreadsheet ID in Firestore settings
      const docRef = doc(db, 'settings', 'googleSheets');
      await setDoc(docRef, {
        spreadsheetId: googleSpreadsheetId.trim(),
        updatedAt: new Date(),
      });

      // 2. Dynamic import and trigger google sheet server action without date filters
      const { syncLogsToGoogleSheet } = await import('@/app/actions/adminActions');
      const res = await syncLogsToGoogleSheet(
        googleSpreadsheetId.trim(),
        null,
        null
      );

      if (res.success) {
        setSheetsSuccess(true);
      } else {
        setSheetsError(res.error);
      }
    } catch (err: any) {
      setSheetsError(err.message || 'An unexpected error occurred during sync.');
    } finally {
      setSheetsLoading(false);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setEmployeeFilter('');
    setStatusFilter('');
    setEmployeeSearch('');
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

  const employeeStartIndex = (employeePage - 1) * employeesPerPage;
  const currentEmployees = filteredEmployees.slice(employeeStartIndex, employeeStartIndex + employeesPerPage);
  const totalEmployeePages = Math.ceil(filteredEmployees.length / employeesPerPage);

  const logStartIndex = (logPage - 1) * logsPerPage;
  const currentLogs = filteredLogs.slice(logStartIndex, logStartIndex + logsPerPage);
  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="loading-spinner mx-auto mb-3" style={{ width: '40px', height: '40px' }}></div>
        <p>Loading admin dashboard...</p>
        <p className="text-muted small">Make sure Firestore has 'employees' and 'timeLogs' collections</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <i className="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
          <h4 className="text-danger">Error Loading Data</h4>
          <p className="text-muted">{error}</p>
          <button className="btn btn-primary" onClick={loadData}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Active Employees */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><i className="fas fa-users me-2"></i>Currently Active Employees</h5>
          <button className="btn btn-sm btn-primary-custom" onClick={loadActiveEmployees}>
            <i className="fas fa-sync me-1"></i>Refresh
          </button>
        </div>
        <div className="card-body">
          {!activeEmployees || activeEmployees.length === 0 ? (
            <div className="text-center py-4">
              <i className="fas fa-users fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">No Active Employees</h5>
              <p className="text-muted">No employees are currently clocked in.</p>
            </div>
          ) : (
            <div className="row">
              {activeEmployees.map((emp, idx) => {
                const clockInTime = emp.clockIn?.toDate();
                const now = new Date();
                const durationHours = clockInTime ? (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) : 0;
                
                return (
                  <div className="col-md-6 col-lg-4 mb-3" key={idx}>
                    <div className="employee-card active">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-1">{emp.employeeName || 'Unknown'}</h6>
                          <p className="mb-1 small text-muted">{emp.employeeId || 'N/A'} - {emp.department || 'N/A'}</p>
                          <p className="mb-1 small">{emp.position || 'N/A'}</p>
                        </div>
                        <span className="status-badge status-in">Active</span>
                      </div>
                      <div>
                        <p className="mb-1 small">
                          <i className="fas fa-sign-in-alt me-1"></i> {clockInTime?.toLocaleTimeString() || 'N/A'}
                        </p>
                        <p className="mb-1 small">
                          <i className="fas fa-clock me-1"></i> {durationHours.toFixed(2)} hours
                        </p>
                        <p className="mb-0 small text-muted">
                          <i className="fas fa-map-marker-alt me-1"></i> {emp.location || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* All Time Logs */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0"><i className="fas fa-list me-2"></i>All Time Logs</h5>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-3 mb-2">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">End Date</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Employee</label>
              <input type="text" className="form-control" placeholder="Search name or ID" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Status</label>
              <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="Clocked In">Clocked In</option>
                <option value="Clocked Out">Clocked Out</option>
              </select>
            </div>
            <div className="col-12">
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-primary-custom" onClick={filterLogs}>
                  <i className="fas fa-filter me-1"></i>Apply Filters
                </button>
                <button className="btn btn-outline-secondary" onClick={clearFilters}>
                  <i className="fas fa-times me-1"></i>Clear Filters
                </button>
                <button className="btn btn-success" onClick={() => {
                  setExportStartDate('');
                  setExportEndDate('');
                  setShowExportModal(true);
                }}>
                  <i className="fas fa-file-excel me-1"></i>Export to CSV
                </button>
                <button className="btn btn-outline-success" onClick={() => {
                  setSheetsSuccess(false);
                  setSheetsError(null);
                  setShowSheetsModal(true);
                }}>
                  <i className="fas fa-file-invoice me-1"></i>Sync to Google Sheets
                </button>
                <button className="btn btn-outline-info" onClick={loadAllTimeLogs}>
                  <i className="fas fa-sync me-1"></i>Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="table-light">
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {!currentLogs || currentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      {timeLogs.length === 0 ? 'No time logs found. Employees need to clock in/out first.' : 'No matching time logs found.'}
                    </td>
                  </tr>
                ) : (
                  currentLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="fw-semibold">{log.employeeName || 'Unknown'}</div>
                        <small className="text-muted">{log.employeeId || 'N/A'}</small>
                      </td>
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
                      <td><small>{log.location || 'N/A'}</small></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalLogPages > 1 && (
            <nav>
              <ul className="pagination justify-content-center">
                <li className={`page-item ${logPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setLogPage(logPage - 1)}>Previous</button>
                </li>
                {Array.from({ length: totalLogPages }, (_, i) => i + 1).map(page => (
                  <li key={page} className={`page-item ${page === logPage ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setLogPage(page)}>{page}</button>
                  </li>
                ))}
                <li className={`page-item ${logPage === totalLogPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setLogPage(logPage + 1)}>Next</button>
                </li>
              </ul>
            </nav>
          )}
          
          <div className="mt-3 text-end">
            <p className="text-muted mb-0">
              Total: {filteredLogs.length} time log(s)
            </p>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><i className="fas fa-users me-2"></i>Employee List</h5>
          <button className="btn btn-sm btn-success" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus me-1"></i>Add Employee
          </button>
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text"><i className="fas fa-search"></i></span>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search employees by name, ID, department..." 
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {!filteredEmployees || filteredEmployees.length === 0 ? (
            <div className="text-center py-4">
              <i className="fas fa-users fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">No Employees Found</h5>
              <p className="text-muted">
                {employees.length === 0 ? 'No employees in database. Click "Add Employee" to create one.' : 'No matching employees found.'}
              </p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td><strong>{emp.employeeId}</strong></td>
                        <td>{emp.name}</td>
                        <td>{emp.email || '--'}</td>
                        <td>{emp.department}</td>
                        <td>{emp.position}</td>
                        <td>
                          <span className={`badge ${emp.role === 'ADMIN' ? 'badge-role-admin' : emp.role === 'Head' ? 'badge-role-head' : 'badge-role-employee'}`}>
                            {emp.role || 'Employee'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${emp.currentStatus === 'Clocked In' ? 'bg-success' : 'bg-secondary'}`}>
                            {emp.currentStatus || 'Not Started'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <button 
                              className="btn btn-sm btn-outline-primary" 
                              onClick={() => handleEditClick(emp)}
                            >
                              <i className="fas fa-edit"></i> Edit
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger" 
                              onClick={() => {
                                setEmployeeToDelete({ id: emp.id, name: emp.name });
                                setShowDeleteModal(true);
                              }}
                            >
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalEmployeePages > 1 && (
                <nav>
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${employeePage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setEmployeePage(employeePage - 1)}>Previous</button>
                    </li>
                    {Array.from({ length: totalEmployeePages }, (_, i) => i + 1).map(page => (
                      <li key={page} className={`page-item ${page === employeePage ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setEmployeePage(page)}>{page}</button>
                      </li>
                    ))}
                    <li className={`page-item ${employeePage === totalEmployeePages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setEmployeePage(employeePage + 1)}>Next</button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="fas fa-user-plus me-2"></i>Add New Employee</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Employee ID *</label>
                    <input type="text" className="form-control" value={newEmployee.employeeId} onChange={(e) => setNewEmployee({...newEmployee, employeeId: e.target.value})} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Full Name *</label>
                    <input type="text" className="form-control" value={newEmployee.name} onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-control" value={newEmployee.email} onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Department *</label>
                    <select className="form-select" value={newEmployee.department} onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}>
                      <option value="">Select Department</option>
                      <option value="Operations">Operations</option>
                      <option value="Therapist">Therapist</option>
                      <option value="Back Office">Back Office</option>
                      <option value="Technical">Technical</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Security">Security</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Reception">Reception</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Position *</label>
                    <input type="text" className="form-control" value={newEmployee.position} onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Role *</label>
                    <select className="form-select" value={newEmployee.role} onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}>
                      <option value="Employee">Employee</option>
                      <option value="Head">Head</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="Manager">Manager</option>
                      <option value="Supervisor">Supervisor</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Password *</label>
                    <input type="password" className="form-control" value={newEmployee.password} onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Confirm Password *</label>
                    <input type="password" className="form-control" value={newEmployee.confirmPassword} onChange={(e) => setNewEmployee({...newEmployee, confirmPassword: e.target.value})} />
                  </div>
                </div>
                {addError && <div className="alert alert-danger">{addError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="button" className="btn btn-success" onClick={handleAddEmployee}>Save Employee</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger"><i className="fas fa-exclamation-triangle me-2"></i>Delete Employee</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete employee <strong>{employeeToDelete.name}</strong>?</p>
                <p className="text-danger"><strong>Warning:</strong> This will permanently delete their account and all time logs. This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteEmployee}>Delete Employee</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && employeeToEdit && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="fas fa-user-edit me-2"></i>Edit Employee Details</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Employee ID *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editEmployeeForm.employeeId} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, employeeId: e.target.value})} 
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Full Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editEmployeeForm.name} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, name: e.target.value})} 
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Department *</label>
                    <select 
                      className="form-select" 
                      value={editEmployeeForm.department} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, department: e.target.value})}
                    >
                      <option value="">Select Department</option>
                      <option value="Operations">Operations</option>
                      <option value="Therapist">Therapist</option>
                      <option value="Back Office">Back Office</option>
                      <option value="Technical">Technical</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Security">Security</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Reception">Reception</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Position *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editEmployeeForm.position} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, position: e.target.value})} 
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Role *</label>
                    <select 
                      className="form-select" 
                      value={editEmployeeForm.role} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, role: e.target.value})}
                    >
                      <option value="Employee">Employee</option>
                      <option value="Head">Head</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="Manager">Manager</option>
                      <option value="Supervisor">Supervisor</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Status *</label>
                    <select 
                      className="form-select" 
                      value={editEmployeeForm.isActive ? 'Active' : 'Inactive'} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, isActive: e.target.value === 'Active'})}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">New Password (Optional)</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="Leave blank to keep current password"
                      value={editEmployeeForm.password} 
                      onChange={(e) => setEditEmployeeForm({...editEmployeeForm, password: e.target.value})} 
                    />
                  </div>
                </div>
                {editError && <div className="alert alert-danger">{editError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary-custom" onClick={handleSaveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Google Sheets Sync Modal */}
      {showSheetsModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="fas fa-file-excel me-2 text-success"></i>Google Sheets Synchronization</h5>
                <button type="button" className="btn-close" onClick={() => setShowSheetsModal(false)} disabled={sheetsLoading}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <h6><i className="fas fa-info-circle me-2"></i>Preparation Instructions (Required):</h6>
                  <ol className="mb-0 mt-2 small">
                    <li>Create a new Google Sheet (or use an existing one).</li>
                    <li>Ensure it has a tab named exactly <strong>Sheet1</strong> (default).</li>
                    <li>Click the <strong>Share</strong> button on the top right of your Google Sheet.</li>
                    <li>Add your Google Service Account email as an <strong>Editor</strong>:
                      <div className="d-flex align-items-center justify-content-between bg-white border rounded p-2 mt-2 font-monospace text-dark">
                        <span>firebase-adminsdk-fbsvc@lead-trend-marine.iam.gserviceaccount.com</span>
                        <button 
                          className="btn btn-xs btn-outline-secondary" 
                          onClick={() => {
                            navigator.clipboard.writeText('firebase-adminsdk-fbsvc@lead-trend-marine.iam.gserviceaccount.com');
                            alert('Copied to clipboard!');
                          }}
                        >
                          <i className="fas fa-copy"></i>
                        </button>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="mb-3">
                  <label className="form-label font-weight-bold">Google Spreadsheet ID *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                    value={googleSpreadsheetId}
                    onChange={(e) => setGoogleSpreadsheetId(e.target.value)}
                    disabled={sheetsLoading}
                  />
                  <div className="form-text small text-muted">
                    This is the long string of characters in your Google Sheet's address bar: 
                    <code>https://docs.google.com/spreadsheets/d/<strong>[SPREADSHEET_ID]</strong>/edit</code>
                  </div>
                </div>

                {sheetsSuccess && (
                  <div className="alert alert-success">
                    <i className="fas fa-check-circle me-2"></i>
                    <strong>Success!</strong> All time logs have been perfectly synchronized and compiled directly into your Google Sheet tab.
                  </div>
                )}

                {sheetsError && (
                  <div className="alert alert-danger">
                    <i className="fas fa-exclamation-circle me-2"></i>
                    <strong>Error:</strong> {sheetsError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => setShowSheetsModal(false)}
                  disabled={sheetsLoading}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={handleSaveSheetsAndSync}
                  disabled={sheetsLoading}
                >
                  {sheetsLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Synchronizing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync me-1"></i>
                      Save Settings & Sync Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export to CSV Modal */}
      {showExportModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px', overflow: 'hidden' }}>
              <div className="modal-header bg-success text-white border-0 py-3">
                <h5 className="modal-title fw-bold"><i className="fas fa-file-csv me-2"></i>Export Time Logs to CSV</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExportModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-muted mb-4 small">
                  Select a specific date range to filter your CSV export. Leave both fields blank to export all logs.
                </p>
                
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary small">Start Date</label>
                  <input 
                    type="date" 
                    className="form-control border-2" 
                    style={{ borderRadius: '8px' }}
                    value={exportStartDate} 
                    onChange={(e) => setExportStartDate(e.target.value)} 
                  />
                </div>
                
                <div className="mb-4">
                  <label className="form-label fw-bold text-secondary small">End Date</label>
                  <input 
                    type="date" 
                    className="form-control border-2" 
                    style={{ borderRadius: '8px' }}
                    value={exportEndDate} 
                    onChange={(e) => setExportEndDate(e.target.value)} 
                  />
                </div>
              </div>
              <div className="modal-footer bg-light border-0 py-3">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary px-4 fw-semibold" 
                  style={{ borderRadius: '8px' }}
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success px-4 fw-semibold" 
                  style={{ borderRadius: '8px' }}
                  onClick={() => exportToCSV(exportStartDate || null, exportEndDate || null)}
                >
                  <i className="fas fa-download me-1"></i>Export Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}