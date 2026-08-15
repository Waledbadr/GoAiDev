import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const maxDuration = 60; // Increase serverless timeout for this route

export async function GET(req: NextRequest) {
  try {
    // 1. Verify this is a valid cron request (e.g., check secret header if Vercel Cron is used)
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    // 2. Determine the date range (e.g., today)
    const today = new Date();
    const startDate = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const endDate = startDate;

    console.log(`[Cron Sync] Starting timesheet sync for date: ${startDate}`);

    // 3. Call your internal attendance fetcher or logic
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Using absolute URL if deployed, otherwise direct logic is preferred
    const fetchResponse = await fetch(`${baseUrl}/api/timesheet/fetch-attendance?start_date=${startDate}&end_date=${endDate}`);
    
    if (!fetchResponse.ok) {
      console.error(`[Cron Sync] Error fetching attendance: ${fetchResponse.status}`);
      return NextResponse.json({ error: "Failed to fetch attendance data" }, { status: 500 });
    }

    const { data } = await fetchResponse.json();

    if (!data || data.length === 0) {
      console.log(`[Cron Sync] No data found for today.`);
      return NextResponse.json({ success: true, message: "No data to sync", count: 0 });
    }

    // 4. Save to Firebase
    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error('[Cron Sync] Firebase Admin DB not initialized.');
      return NextResponse.json({ error: "Firebase not configured on server" }, { status: 500 });
    }

    const batch = adminDb.batch();
    
    for (const record of data) {
      // Create a unique ID for each record to prevent duplicates (e.g. employeeId_date_time)
      const recordId = `${record.employeeId}_${record.date}_${record.time.replace(/:/g, '')}`;
      const docRef = adminDb.collection('timesheets').doc(recordId);
      
      batch.set(docRef, {
        ...record,
        syncedAt: new Date(),
        // optional: convert date strings to Firestore timestamps if needed
      }, { merge: true });
    }

    await batch.commit();

    console.log(`[Cron Sync] Successfully synced ${data.length} records to Firebase.`);

    return NextResponse.json({ 
      success: true, 
      message: "Sync completed successfully", 
      syncedCount: data.length 
    });

  } catch (error: any) {
    console.error('[Cron Sync] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
