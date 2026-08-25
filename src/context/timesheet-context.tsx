"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { RawPunch, DailyAttendance, TimesheetEvent, EmployeeSchedule } from "@/types/timesheet";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { d1Client } from "@/lib/d1-client";
import { doc, writeBatch, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { mergeAttendanceRecord, processPunches } from "@/utils/timesheet-utils";
import { useLanguage } from "@/context/language-context";
import { getDateChunks } from "@/lib/fiscal-month-utils";

interface TimesheetContextType {
  rawPunches: RawPunch[];
  processedAttendance: DailyAttendance[];
  deviceToProjectMap: Record<string, string>;
  projectToResidenceMap: Record<string, string>;
  timesheetEvents: TimesheetEvent[];
  employeeSchedules: EmployeeSchedule[];
  isFetching: boolean;
  isProcessing: boolean;
  isSaving: boolean;
  fetchAndProcessAttendance: (startDate: string, endDate: string) => Promise<void>;
  syncProcessedDataToFirestore: () => Promise<void>;
  clearProcessedAttendance: () => void;
  deleteAllAttendanceRecords: () => Promise<void>;
  updateAttendanceRecord: (id: string, updates: Partial<DailyAttendance>) => void;
  updateDeviceMapping: (deviceName: string, projectName: string) => Promise<void>;
  updateBulkDeviceMappings: (mappings: Record<string, string>) => Promise<void>;
  removeDeviceMapping: (deviceName: string) => Promise<void>;
  updateProjectMapping: (biometricProject: string, residenceId: string) => Promise<void>;
  removeProjectMapping: (biometricProject: string) => Promise<void>;
  updateEvents: (events: TimesheetEvent[]) => Promise<void>;
  updateSchedules: (schedules: EmployeeSchedule[]) => Promise<void>;
}

const TimesheetContext = createContext<TimesheetContextType | undefined>(undefined);

export function TimesheetProvider({ children }: { children: ReactNode }) {
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([]);
  const [processedAttendance, setProcessedAttendance] = useState<DailyAttendance[]>([]);
  const [deviceToProjectMap, setDeviceToProjectMap] = useState<Record<string, string>>({});
  const [projectToResidenceMap, setProjectToResidenceMap] = useState<Record<string, string>>({});
  const [timesheetEvents, setTimesheetEvents] = useState<TimesheetEvent[]>([]);
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeSchedule[]>([]);
  // Kept only for the current import so a merged day is recalculated with the
  // same leave/transfer rules used when it was first previewed.
  const [importContext, setImportContext] = useState<{ leaves: any[]; transfers: any[]; employees: any[] }>({ leaves: [], transfers: [], employees: [] });
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { locale } = useLanguage();
  const isAr = locale === "ar";
  
  // Load mappings on mount from Cloudflare D1
  React.useEffect(() => {
    const loadMapping = async () => {
      try {
        const d1Settings = await d1Client.getDoc<any>('residences', 'timesheetSettings');
        if (d1Settings) {
          setDeviceToProjectMap(d1Settings.deviceToProjectMap || {});
          setProjectToResidenceMap(d1Settings.projectToResidenceMap || {});
          setTimesheetEvents(d1Settings.timesheetEvents || []);
          setEmployeeSchedules(d1Settings.employeeSchedules || []);
          return;
        }

        if (db) {
          const snap = await getDoc(doc(db, "residences", "timesheetSettings"));
          if (snap.exists()) {
            const data = snap.data();
            setDeviceToProjectMap(data.deviceToProjectMap || {});
            setProjectToResidenceMap(data.projectToResidenceMap || {});
            setTimesheetEvents(data.timesheetEvents || []);
            setEmployeeSchedules(data.employeeSchedules || []);
          }
        }
      } catch (e) {
        console.error("Failed to load timesheet settings", e);
      }
    };
    loadMapping();
  }, []);

  const updateDeviceMapping = async (deviceName: string, projectName: string) => {
    const newMap = { ...deviceToProjectMap, [deviceName]: projectName };
    setDeviceToProjectMap(newMap);
    await d1Client.setDoc('residences', 'timesheetSettings', { deviceToProjectMap: newMap });
  };

  const updateBulkDeviceMappings = async (mappings: Record<string, string>) => {
    const newMap = { ...deviceToProjectMap, ...mappings };
    setDeviceToProjectMap(newMap);
    await d1Client.setDoc('residences', 'timesheetSettings', { deviceToProjectMap: newMap });
  };

  const removeDeviceMapping = async (deviceName: string) => {
    const newMap = { ...deviceToProjectMap };
    delete newMap[deviceName];
    setDeviceToProjectMap(newMap);
    await d1Client.setDoc('residences', 'timesheetSettings', { deviceToProjectMap: newMap });
  };

  const updateProjectMapping = async (biometricProject: string, residenceId: string) => {
    const newMap = { ...projectToResidenceMap, [biometricProject]: residenceId };
    setProjectToResidenceMap(newMap);
    await d1Client.setDoc('residences', 'timesheetSettings', { projectToResidenceMap: newMap });
  };

  const removeProjectMapping = async (biometricProject: string) => {
    const newMap = { ...projectToResidenceMap };
    delete newMap[biometricProject];
    setProjectToResidenceMap(newMap);
    await d1Client.setDoc('residences', 'timesheetSettings', { projectToResidenceMap: newMap });
  };

  const updateEvents = async (events: TimesheetEvent[]) => {
    setTimesheetEvents(events);
    await d1Client.setDoc('residences', 'timesheetSettings', { timesheetEvents: events });
  };

  const updateSchedules = async (schedules: EmployeeSchedule[]) => {
    setEmployeeSchedules(schedules);
    await d1Client.setDoc('residences', 'timesheetSettings', { employeeSchedules: schedules });
  };

  const fetchAndProcessAttendance = async (startDate: string, endDate: string) => {
    setIsFetching(true);
    setRawPunches([]);
    setProcessedAttendance([]);

    try {
      // 1. Split into chunks to avoid Biometric Server timeouts (7 days per request)
      const chunks = getDateChunks(startDate, endDate, 7);
      let allPunches: RawPunch[] = [];
      
      // 2. Fetch ancillary data (leaves, transfers, all employees) once for the entire period
      let leavesData: any[] = [];
      let transfersData: any[] = [];
      let employeesData: any[] = [];
      try {
        if (db) {
          const [lSnap, tSnap, eSnap] = await Promise.all([
            getDocs(collection(db as any, 'timesheetLeaves')),
            getDocs(collection(db as any, 'timesheetTransfers')),
            getDocs(collection(db as any, 'housingEmployees'))
          ]);
          leavesData = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          transfersData = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          employeesData = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn("Failed to fetch leaves/transfers/employees for processing", e);
      }

      // 3. Serial fetching of chunks to keep biometric server load manageable
      for (const chunk of chunks) {
        const res = await fetch(`/api/timesheet/fetch-attendance?start_date=${chunk.start}&end_date=${chunk.end}`);
        if (!res.ok) {
          let errorMsg = res.statusText;
          try {
            const errBody = await res.json();
            errorMsg = errBody.error || errBody.message || errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }
        
        const json = await res.json();
        if (json.data) {
          allPunches = [...allPunches, ...json.data];
        }
      }

      setRawPunches(allPunches);
      setIsFetching(false);
      
      setIsProcessing(true);
      // Process data grouping by emp_id and date
      const processed = processPunches(
        allPunches, 
        deviceToProjectMap, 
        timesheetEvents, 
        employeeSchedules, 
        leavesData,
        startDate,
        endDate,
        employeesData,
        transfersData // Pass transfers
      );
      setImportContext({ leaves: leavesData, transfers: transfersData, employees: employeesData });
      setProcessedAttendance(processed);
      setIsProcessing(false);
      
      toast({
        title: isAr ? "تم الاستيراد بنجاح" : "Import Successful",
        description: isAr 
          ? `تم إحضار ${allPunches.length} بصمة، ومعالجتها إلى ${processed.length} سجل يومي.`
          : `Fetched ${allPunches.length} punches, processed into ${processed.length} daily records.`,
        variant: "default",
      });

    } catch (error: any) {
      console.error("Attendance fetch error:", error);
      toast({
        title: isAr ? "فشل جلب البيانات" : "Fetch Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
      setIsProcessing(false);
    }
  };

  const updateAttendanceRecord = (id: string, updates: Partial<DailyAttendance>) => {
    setProcessedAttendance(prev => prev.map(record => {
      if (record.id === id) {
        return { ...record, ...updates, isSyncedToFirestore: false };
      }
      return record;
    }));
  };

  const syncProcessedDataToFirestore = async () => {
    if (processedAttendance.length === 0) return;

    setIsSaving(true);
    try {
      const syncedAt = new Date().toISOString();
      const recordsToSave = processedAttendance.map(record => ({
        ...record,
        syncedAt,
        lastSourceSyncAt: syncedAt,
      }));

      // High-speed batch save to Cloudflare D1
      const savedCount = await d1Client.setDocsBatch('attendanceRecords', recordsToSave);

      // Clear in-memory data to signal that the save was successful
      setRawPunches([]);
      setProcessedAttendance([]);
      setImportContext({ leaves: [], transfers: [], employees: [] });
      
      toast({
        title: isAr ? "تم الحفظ بنجاح" : "Save Successful",
        description: isAr
          ? `تم حفظ ومزامنة ${savedCount} سجل على قاعدة بيانات Cloudflare D1 فوراً.`
          : `Saved and synced ${savedCount} records to Cloudflare D1 instantly.`,
        variant: "default",
      });

    } catch (error: any) {
      console.error("Error syncing timesheet:", error);
      toast({
        title: isAr ? "فشل الحفظ" : "Save Failed",
        description: isAr ? "حدث خطأ أثناء محاولة حفظ السجلات." : "An error occurred while saving the records.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearProcessedAttendance = () => {
    setRawPunches([]);
    setProcessedAttendance([]);
  };

  const deleteAllAttendanceRecords = async () => {
    try {
      const records = await d1Client.getDocs('attendanceRecords');
      if (!records || records.length === 0) {
        toast({ title: isAr ? 'لا توجد سجلات' : 'No records found', variant: 'default' });
        return;
      }
      for (const rec of records) {
        await d1Client.deleteDoc('attendanceRecords', rec.id);
      }

      toast({
        title: isAr ? 'تم الحذف' : 'Records Deleted',
        description: isAr
          ? `تم حذف ${records.length} سجل بنجاح من Cloudflare D1. يمكنك إعادة الاستيراد الآن.`
          : `Deleted ${records.length} records from Cloudflare D1. You can re-import now.`,
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error deleting attendance records:', error);
      toast({
        title: isAr ? 'خطأ في الحذف' : 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <TimesheetContext.Provider
      value={{
        rawPunches,
        processedAttendance,
        projectToResidenceMap,
        timesheetEvents,
        employeeSchedules,
        isFetching,
        isProcessing,
        isSaving,
        fetchAndProcessAttendance,
        syncProcessedDataToFirestore,
        clearProcessedAttendance,
        deleteAllAttendanceRecords,
        updateAttendanceRecord,
        updateProjectMapping,
        removeProjectMapping,
        deviceToProjectMap,
        updateDeviceMapping,
        updateBulkDeviceMappings,
        removeDeviceMapping,
        updateEvents,
        updateSchedules,
      }}
    >
      {children}
    </TimesheetContext.Provider>
  );
}

export function useTimesheet() {
  const context = useContext(TimesheetContext);
  if (context === undefined) {
    throw new Error("useTimesheet must be used within a TimesheetProvider");
  }
  return context;
}
