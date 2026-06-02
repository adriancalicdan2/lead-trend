export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  role: string;
  position: string;
  uid: string;
  createdAt?: any;
  currentStatus: string;
  isActive: boolean;
  lastClockIn?: any;
  lastClockOut?: any;
}

export interface TimeLog {
  id?: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  clockIn: any;
  clockOut: any;
  status: string;
  date: string;
  location: string;
  duration: number | null;
  undertime: boolean;
  overtime: boolean;
  autoClockOut: boolean;
  notes: string;
  roundedClockIn?: string;
  roundedClockOut?: string;
  actualClockIn?: string;
  actualClockOut?: string;
}

export type NewEmployee = {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  isActive: boolean;
};