import { auth, db } from '@/app/firebase/config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  UserCredential 
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
  deleteDoc,
} from 'firebase/firestore';
import { Employee, TimeLog, NewEmployee } from '@/types';

class TimeTrackerService {
  private TARGET_HOURS = 10;

  roundToNearestHour(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getRoundedTimestamp(date: Date): Date {
    return new Date(date);
  }

  async loginUser(email: string, password: string): Promise<UserCredential> {
    return await signInWithEmailAndPassword(auth, email, password);
  }

  async logoutUser(): Promise<void> {
    return await signOut(auth);
  }

  async getCurrentEmployee(): Promise<Employee | null> {
    const user = auth.currentUser;
    if (!user) return null;
    
    // Auto-sync status on current user
    await this.syncEmployeeStatus(user.uid);
    
    const docRef = doc(db, 'employees', user.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Employee;
    }
    return null;
  }

  async addEmployee(employeeData: NewEmployee, password: string): Promise<void> {
    const idQuery = query(collection(db, 'employees'), where('employeeId', '==', employeeData.employeeId));
    const idSnap = await getDocs(idQuery);
    if (!idSnap.empty) throw new Error('Employee ID already exists');
    
    const emailQuery = query(collection(db, 'employees'), where('email', '==', employeeData.email));
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) throw new Error('Email already registered');
    
    const userCredential = await createUserWithEmailAndPassword(auth, employeeData.email, password);
    
    const employeeDoc = {
      employeeId: employeeData.employeeId,
      name: employeeData.name,
      email: employeeData.email,
      department: employeeData.department,
      position: employeeData.position,
      role: employeeData.role,
      isActive: employeeData.isActive,
      uid: userCredential.user.uid,
      createdAt: serverTimestamp(),
      currentStatus: 'Not Started',
    };
    
    await setDoc(doc(db, 'employees', userCredential.user.uid), employeeDoc);
  }

  async getAllEmployees(): Promise<Employee[]> {
    const querySnapshot = await getDocs(collection(db, 'employees'));
    
    // Sync statuses in background
    const syncPromises: Promise<void>[] = [];
    querySnapshot.forEach((doc) => {
      syncPromises.push(this.syncEmployeeStatus(doc.id));
    });
    await Promise.all(syncPromises);

    // Re-fetch to return latest data
    const reSnapshot = await getDocs(collection(db, 'employees'));
    const employees: Employee[] = [];
    reSnapshot.forEach((doc) => {
      employees.push({ id: doc.id, ...doc.data() } as Employee);
    });
    return employees;
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    const employeeRef = doc(db, 'employees', employeeId);
    await deleteDoc(employeeRef);
  }

  async updateEmployee(employeeId: string, employeeData: Partial<Employee>): Promise<void> {
    const employeeRef = doc(db, 'employees', employeeId);
    await updateDoc(employeeRef, {
      ...employeeData,
      updatedAt: serverTimestamp(),
    });
  }

  async getTodayTimeLog(employeeId: string): Promise<TimeLog | null> {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'timeLogs'),
      where('employeeId', '==', employeeId),
      where('date', '==', today)
    );
    const querySnapshot = await getDocs(q);
    
    let todayLog: TimeLog | null = null;
    querySnapshot.forEach((doc) => {
      todayLog = { id: doc.id, ...doc.data() } as TimeLog;
    });
    return todayLog;
  }

  async clockIn(employee: Employee): Promise<any> {
    const existingLog = await this.getTodayTimeLog(employee.employeeId);
    if (existingLog && existingLog.status === 'Clocked In') {
      throw new Error('Already clocked in today');
    }
    
    const now = new Date();
    const roundedTimeString = this.roundToNearestHour(now);
    
    let location = 'Office';
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      location = `${data.city}, ${data.region}`;
    } catch (e) {
      console.log('Location service failed, using default');
    }
    
    const today = new Date().toISOString().split('T')[0];
    const clockInData = {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      position: employee.position,
      clockIn: serverTimestamp(),
      clockOut: null,
      status: 'Clocked In',
      date: today,
      location: location,
      duration: null,
      undertime: false,
      overtime: false,
      autoClockOut: false,
      notes: '',
      roundedClockIn: roundedTimeString,
      actualClockIn: now.toISOString(),
    };
    
    const docRef = await addDoc(collection(db, 'timeLogs'), clockInData);
    
    const employeeRef = doc(db, 'employees', employee.id);
    await updateDoc(employeeRef, {
      currentStatus: 'Clocked In',
      lastClockIn: serverTimestamp(),
    });
    
    return { success: true, logId: docRef.id, location, roundedTime: roundedTimeString };
  }

  async clockOut(logId: string, employeeId: string): Promise<any> {
    const logRef = doc(db, 'timeLogs', logId);
    const logDoc = await getDoc(logRef);
    
    if (!logDoc.exists()) throw new Error('Time log not found');
    
    const logData = logDoc.data();
    const now = new Date();
    const roundedOutTimeString = this.roundToNearestHour(now);
    
    const actualInTime = logData.clockIn?.toDate() || new Date(logData.actualClockIn || logData.date);
    const durationMs = now.getTime() - actualInTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    const undertime = durationHours < this.TARGET_HOURS;
    const overtime = durationHours > this.TARGET_HOURS;
    
    await updateDoc(logRef, {
      clockOut: serverTimestamp(),
      roundedClockOut: roundedOutTimeString,
      actualClockOut: now.toISOString(),
      duration: parseFloat(durationHours.toFixed(2)),
      status: 'Clocked Out',
      undertime: undertime,
      overtime: overtime,
      autoClockOut: false,
    });
    
    const employeeRef = doc(db, 'employees', employeeId);
    await updateDoc(employeeRef, {
      currentStatus: 'Clocked Out',
      lastClockOut: serverTimestamp(),
    });
    
    return { 
      success: true, 
      duration: durationHours, 
      undertime, 
      overtime,
      roundedInTime: logData.roundedClockIn,
      roundedOutTime: roundedOutTimeString
    };
  }

  async syncEmployeeStatus(employeeId: string): Promise<void> {
    try {
      const employeeRef = doc(db, 'employees', employeeId);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) return;
      const employeeData = employeeSnap.data() as Employee;

      // Find the most recent time log for this employee by sorting by clockIn descending
      const q = query(
        collection(db, 'timeLogs'),
        where('employeeId', '==', employeeData.employeeId),
        orderBy('clockIn', 'desc'),
        limit(1)
      );
      const logSnap = await getDocs(q);
      
      let latestLog: TimeLog | null = null;
      logSnap.forEach((doc) => {
        latestLog = { id: doc.id, ...doc.data() } as TimeLog;
      });

      const today = new Date().toISOString().split('T')[0];

      if (latestLog) {
        const log = latestLog as TimeLog;
        
        // Scenario A: Latest log is from a previous day and still 'Clocked In'
        if (log.status === 'Clocked In' && log.date !== today) {
          console.log(`Auto clocking out stale session for employee ${employeeId} from date ${log.date}`);
          
          const clockInTime = log.clockIn?.toDate ? log.clockIn.toDate() : new Date(log.actualClockIn || log.date);
          const autoOutTime = new Date(clockInTime.getTime() + this.TARGET_HOURS * 60 * 60 * 1000);
          const roundedOutTimeString = this.roundToNearestHour(autoOutTime);

          const logRef = doc(db, 'timeLogs', log.id!);
          await updateDoc(logRef, {
            clockOut: serverTimestamp(),
            roundedClockOut: roundedOutTimeString,
            actualClockOut: autoOutTime.toISOString(),
            duration: this.TARGET_HOURS,
            status: 'Clocked Out',
            undertime: false,
            overtime: false,
            autoClockOut: true,
          });

          await updateDoc(employeeRef, {
            currentStatus: 'Clocked Out',
            lastClockOut: serverTimestamp(),
          });
        }
        // Scenario B: Latest log is 'Clocked Out' (including autoClockOut: true) but employee is 'Clocked In'
        else if (log.status === 'Clocked Out' && employeeData.currentStatus === 'Clocked In') {
          console.log(`Syncing status for employee ${employeeId}: time log is Clocked Out but employee doc was Clocked In`);
          await updateDoc(employeeRef, {
            currentStatus: 'Clocked Out',
            lastClockOut: log.clockOut || serverTimestamp(),
          });
        }
        // Scenario C: Latest log is 'Clocked In' today, but employee doc is not 'Clocked In'
        else if (log.status === 'Clocked In' && log.date === today && employeeData.currentStatus !== 'Clocked In') {
          console.log(`Syncing status for employee ${employeeId}: time log is Clocked In but employee doc was not`);
          await updateDoc(employeeRef, {
            currentStatus: 'Clocked In',
            lastClockIn: log.clockIn || serverTimestamp(),
          });
        }
      } else {
        // No logs at all, but employee doc says 'Clocked In'
        if (employeeData.currentStatus === 'Clocked In') {
          await updateDoc(employeeRef, {
            currentStatus: 'Clocked Out',
          });
        }
      }
    } catch (error) {
      console.error(`Error in syncEmployeeStatus for employee ${employeeId}:`, error);
    }
  }

  async getEmployeeTimeLogs(employeeId: string, limitCount: number = 10): Promise<TimeLog[]> {
    const q = query(
      collection(db, 'timeLogs'),
      where('employeeId', '==', employeeId),
      orderBy('clockIn', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const logs: TimeLog[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as TimeLog);
    });
    return logs;
  }

  async getAllTimeLogs(): Promise<TimeLog[]> {
    const q = query(collection(db, 'timeLogs'), orderBy('clockIn', 'desc'));
    const querySnapshot = await getDocs(q);
    const logs: TimeLog[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as TimeLog);
    });
    return logs;
  }

  async getActiveEmployees(): Promise<any[]> {
    const q = query(
      collection(db, 'timeLogs'),
      where('status', '==', 'Clocked In')
    );
    const querySnapshot = await getDocs(q);
    const active: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const docSnap of querySnapshot.docs) {
      const logData = docSnap.data() as TimeLog;
      if (logData.date !== today) {
        // Query employee to find their DB id and run auto-sync
        const empQuery = query(collection(db, 'employees'), where('employeeId', '==', logData.employeeId));
        const empSnapshot = await getDocs(empQuery);
        if (!empSnapshot.empty) {
          const empDoc = empSnapshot.docs[0];
          await this.syncEmployeeStatus(empDoc.id);
        }
      } else {
        active.push({ id: docSnap.id, ...logData });
      }
    }
    return active;
  }

  async getEmployeeStats(employeeId: string): Promise<any> {
    const logs = await this.getEmployeeTimeLogs(employeeId, 100);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoDate = oneWeekAgo.toISOString().split('T')[0];
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const monthAgoDate = oneMonthAgo.toISOString().split('T')[0];
    
    let weeklyHours = 0;
    let monthlyHours = 0;
    
    logs.forEach((log) => {
      if (log.duration) {
        if (log.date >= monthAgoDate) {
          monthlyHours += log.duration;
        }
        if (log.date >= weekAgoDate) {
          weeklyHours += log.duration;
        }
      }
    });
    
    return {
      weeklyHours: parseFloat(weeklyHours.toFixed(2)),
      monthlyHours: parseFloat(monthlyHours.toFixed(2)),
    };
  }

  async exportTimeLogsToExcel(startDate: string | null, endDate: string | null): Promise<any[]> {
    const logs = await this.getAllTimeLogs();
    
    let filteredLogs = logs;
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.date >= startDate);
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.date <= endDate);
    }
    
    return filteredLogs.map((log) => ({
      'Employee ID': log.employeeId,
      'Employee Name': log.employeeName,
      'Department': log.department,
      'Position': log.position,
      'Date': log.date,
      'Clock In': log.roundedClockIn || (log.actualClockIn ? new Date(log.actualClockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : 'N/A'),
      'Clock Out': log.roundedClockOut || (log.actualClockOut ? new Date(log.actualClockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : 'N/A'),
      'Duration (hours)': log.duration || 0,
      'Target Hours': this.TARGET_HOURS,
      'Status': log.status,
      'Undertime': log.undertime ? 'Yes' : 'No',
      'Overtime': log.overtime ? 'Yes' : 'No',
      'Location': log.location || 'N/A',
    }));
  }
}

export const timeTrackerService = new TimeTrackerService();