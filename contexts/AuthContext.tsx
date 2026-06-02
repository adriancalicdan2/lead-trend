"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '@/app/firebase/config';
import { Employee as EmployeeType } from '@/types';
import { timeTrackerService } from '@/services/timeTrackerService';

// Employee interface
interface Employee {
  uid: string;
  email: string;
  name: string;
  employeeId?: string;
  department?: string;
  position?: string;
  role: string;
  isActive: boolean;
  currentStatus: string;
  createdAt: Date | any;
  lastLogin?: Date | any;
  phoneNumber?: string;
  profileImage?: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  employeeData: Employee | null;
  employee: EmployeeType | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateEmployeeData: (data: Partial<Employee>) => Promise<void>;
  refreshEmployeeData: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch employee document from Firestore
  const fetchEmployeeData = async (uid: string): Promise<Employee | null> => {
    try {
      // Sync status before reading
      await timeTrackerService.syncEmployeeStatus(uid);

      const employeeDocRef = doc(db, 'employees', uid);
      const employeeDoc = await getDoc(employeeDocRef);
      
      if (employeeDoc.exists()) {
        const data = employeeDoc.data();
        return {
          uid: data.uid || uid,
          email: data.email || '',
          name: data.name || '',
          employeeId: data.employeeId,
          department: data.department,
          position: data.position,
          role: data.role || 'Employee',
          isActive: data.isActive ?? true,
          currentStatus: data.currentStatus || 'Not Started',
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          phoneNumber: data.phoneNumber,
          profileImage: data.profileImage,
        };
      }

      // Fallback: Query by 'uid' field to find documents created with random IDs
      const q = query(collection(db, 'employees'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        const employeeData = {
          uid: data.uid || uid,
          email: data.email || '',
          name: data.name || '',
          employeeId: data.employeeId,
          department: data.department,
          position: data.position,
          role: data.role || 'Employee',
          isActive: data.isActive ?? true,
          currentStatus: data.currentStatus || 'Not Started',
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          phoneNumber: data.phoneNumber,
          profileImage: data.profileImage,
        };
        
        // Auto-migrate: Move it to the correct document ID (the user's UID) and delete the old one
        try {
          await setDoc(doc(db, 'employees', uid), data);
          await deleteDoc(docSnap.ref);
          console.log(`Auto-migrated employee doc for UID ${uid} from random ID ${docSnap.id} to UID-based document ID`);
        } catch (migrationError) {
          console.error('Failed to auto-migrate random employee document ID:', migrationError);
        }
        
        return employeeData;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching employee data:', error);
      return null;
    }
  };

  // Create employee document for new user
  const createEmployeeDocument = async (user: User, name: string): Promise<void> => {
    try {
      const employeeDocRef = doc(db, 'employees', user.uid);
      const employeeData = {
        uid: user.uid,
        email: user.email,
        name: name || user.email?.split('@')[0] || 'Unknown',
        role: 'Employee',
        isActive: true,
        currentStatus: 'Not Started',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        employeeId: `EMP${Date.now().toString().slice(-6)}`,
      };
      
      await setDoc(employeeDocRef, employeeData);
      console.log('Employee document created successfully');
    } catch (error) {
      console.error('Error creating employee document:', error);
      throw error;
    }
  };

  // Update last login timestamp
  const updateLastLogin = async (uid: string): Promise<void> => {
    try {
      const employeeDocRef = doc(db, 'employees', uid);
      await updateDoc(employeeDocRef, {
        lastLogin: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  // Refresh employee data
  const refreshEmployeeData = async () => {
    if (user) {
      const data = await fetchEmployeeData(user.uid);
      setEmployeeData(data);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      // Fetch or create employee document
      let employee = await fetchEmployeeData(loggedInUser.uid);
      
      if (!employee) {
        console.log('No employee document found, creating one...');
        await createEmployeeDocument(loggedInUser, loggedInUser.displayName || '');
        employee = await fetchEmployeeData(loggedInUser.uid);
      } else {
        // Update last login for existing employee
        await updateLastLogin(loggedInUser.uid);
      }
      
      setEmployeeData(employee);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      // Update profile with display name
      await updateProfile(newUser, { displayName: name });
      
      // Create employee document
      await createEmployeeDocument(newUser, name);
      
      // Fetch the created employee data
      const employee = await fetchEmployeeData(newUser.uid);
      setEmployeeData(employee);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setEmployeeData(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  // Update employee data function
  const updateEmployeeData = async (data: Partial<Employee>) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const employeeDocRef = doc(db, 'employees', user.uid);
      await updateDoc(employeeDocRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      // Refresh local state
      await refreshEmployeeData();
    } catch (error) {
      console.error('Error updating employee data:', error);
      throw error;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch employee data when user is authenticated
        const employee = await fetchEmployeeData(currentUser.uid);
        
        if (!employee) {
          console.warn('No employee document found for user:', currentUser.uid);
          // Optional: Auto-create missing document even for existing users
          // Uncomment the next lines if you want to auto-create missing docs
          /*
          await createEmployeeDocument(currentUser, currentUser.displayName || '');
          const newEmployee = await fetchEmployeeData(currentUser.uid);
          setEmployeeData(newEmployee);
          */
        } else {
          setEmployeeData(employee);
          // Update last login in background
          updateLastLogin(currentUser.uid);
        }
      } else {
        setEmployeeData(null);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Build an Employee-typed object from employeeData for components that need it
  const employee: EmployeeType | null = employeeData ? {
    id: employeeData.uid,
    uid: employeeData.uid,
    employeeId: employeeData.employeeId || '',
    name: employeeData.name,
    email: employeeData.email,
    department: employeeData.department || '',
    position: employeeData.position || '',
    role: employeeData.role,
    isActive: employeeData.isActive,
    currentStatus: employeeData.currentStatus,
    createdAt: employeeData.createdAt,
  } : null;

  const isAdmin = employeeData?.role === 'ADMIN';

  const value = {
    user,
    employeeData,
    employee,
    isAdmin,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateEmployeeData,
    refreshEmployeeData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};