"use server";

import * as admin from 'firebase-admin';
import { google } from 'googleapis';

// Initialize Admin SDK safely
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
  }
}

export async function updateEmployeePassword(uid: string, newPassword: string) {
  if (!uid || !newPassword) {
    return { success: false, error: 'User ID and password are required.' };
  }
  
  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  // Check if admin environment credentials are configured
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return { 
      success: false, 
      error: 'Firebase Admin credentials are not configured. Please add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to your .env.local file.' 
    };
  }

  try {
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user password via Admin SDK:', error);
    return { success: false, error: error.message || 'Failed to update password.' };
  }
}

export async function syncLogsToGoogleSheet(spreadsheetId: string, startDate: string | null, endDate: string | null) {
  if (!spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID is required.' };
  }

  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return { 
      success: false, 
      error: 'Google credentials are not configured in .env.local. Please make sure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set.' 
    };
  }

  try {
    // 1. Fetch all time logs from Firestore
    const db = admin.firestore();
    const logsSnapshot = await db.collection('timeLogs').orderBy('clockIn', 'desc').get();
    
    if (logsSnapshot.empty) {
      return { success: false, error: 'No time logs found to synchronize.' };
    }

    const timeLogs: any[] = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Apply date filtering
      if (startDate && data.date < startDate) return;
      if (endDate && data.date > endDate) return;
      
      timeLogs.push(data);
    });

    if (timeLogs.length === 0) {
      return { success: false, error: 'No time logs found matching the selected date filters.' };
    }

    // 2. Prepare headers and rows for Sheets
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Date',
      'Clock In',
      'Clock Out',
      'Duration (Hours)',
      'Status',
      'Undertime',
      'Overtime',
      'Location',
      'Notes'
    ];

    const rows = timeLogs.map(log => {
      const formatTime = (ts: any) => {
        if (!ts) return 'N/A';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      };

      return [
        log.employeeId || 'N/A',
        log.employeeName || 'Unknown',
        log.department || 'N/A',
        log.position || 'N/A',
        log.date || 'N/A',
        log.roundedClockIn || formatTime(log.clockIn),
        log.roundedClockOut || formatTime(log.clockOut),
        log.duration || 0,
        log.status || 'N/A',
        log.undertime ? 'Yes' : 'No',
        log.overtime ? 'Yes' : 'No',
        log.location || 'N/A',
        log.notes || ''
      ];
    });

    // 3. Authenticate with Google Sheets API
    const auth = new google.auth.JWT({
      email: process.env.FIREBASE_CLIENT_EMAIL,
      key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 4. Overwrite Sheet1 with latest table
    const range = 'Sheet1!A1';
    
    // Clear old data first
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1!A1:Z10000',
    });

    // Update with fresh data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers, ...rows],
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error syncing to Google Sheet:', error);
    return { success: false, error: error.message || 'Failed to sync to Google Sheet.' };
  }
}
