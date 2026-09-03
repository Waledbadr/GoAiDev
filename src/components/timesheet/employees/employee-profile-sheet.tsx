'use client';

import { useState, useEffect } from 'react';
import { d1Client } from '@/lib/d1-client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HousingEmployee, useHousingEmployees } from '@/context/housing-employees-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Plane, Activity, Calendar, ShieldAlert, Trash2, Clock, AlertCircle } from 'lucide-react';

interface EmployeeProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: HousingEmployee | null;
  /** Optional default date coming from Monthly Archive when opening via shortcut */
  defaultDate?: string | null;
}

export function EmployeeProfileSheet({ open, onOpenChange, employee, defaultDate }: EmployeeProfileSheetProps) {
  const { updateEmployee } = useHousingEmployees();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('general');
  const [generalData, setGeneralData] = useState<Partial<HousingEmployee>>({});

  // Leave State
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveData, setLeaveData] = useState({
    type: 'Annual',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Transfer State
  const [transfers, setTransfers] = useState<any[]>([]);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferData, setTransferData] = useState({
    type: 'Move In',
    date: '',
    location: '',
    reason: ''
  });

  // Exceptions State
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionData, setExceptionData] = useState({
    type: 'Permission',
    startDate: '',
    endDate: '',
    hours: '',
    reason: ''
  });

  const loadSubData = async () => {
    if (!employee) return;
    try {
      const [allLeaves, allTransfers, allExceptions] = await Promise.all([
        d1Client.getDocs<any>('timesheetLeaves'),
        d1Client.getDocs<any>('timesheetTransfers'),
        d1Client.getDocs<any>('timesheetExceptions'),
      ]);

      const empLeaves = (allLeaves || []).filter(l => l.employeeId === employee.id || l.employeeDocId === employee.id || l.badgeId === employee.employeeId);
      const empTransfers = (allTransfers || []).filter(t => t.employeeId === employee.id || t.badgeId === employee.employeeId);
      const empExceptions = (allExceptions || []).filter(e => e.employeeId === employee.id || e.badgeId === employee.employeeId);

      setLeaves(empLeaves);
      setTransfers(empTransfers);
      setExceptions(empExceptions);
    } catch (e) {
      console.warn('Error loading employee subdata from D1:', e);
    }
  };

  // Reset local state when employee or defaultDate changes
  useEffect(() => {
    if (employee) {
      const initialProject = employee.projectName || (employee as any).project || '';
      setGeneralData({
        name: employee.name || '',
        nameAr: employee.nameAr || '',
        employeeId: employee.employeeId || '',
        profession: employee.profession || '',
        professionAr: employee.professionAr || '',
        department: employee.department || '',
        projectName: initialProject,
        dailyHours: employee.dailyHours || 8,
        monthlySalary: employee.monthlySalary || 0,
        status: employee.status || 'Active',
        residenceStatus: employee.residenceStatus || 'Inside',
        residenceLocation: employee.residenceLocation || '',
      });
      setShowLeaveForm(false);
      setShowTransferForm(false);
      setShowExceptionForm(false);

      // If projectName is empty, attempt to infer from latest attendance punch
      if (!initialProject) {
        d1Client.getDocs<any>('attendanceRecords').then((records) => {
          const empKey = String(employee.employeeId || employee.id).trim();
          const empRecs = (records || [])
            .filter((r) => String(r.employeeId).trim() === empKey && r.projectName && r.projectName !== 'Unassigned / Outside')
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
          if (empRecs.length > 0 && empRecs[0].projectName) {
            setGeneralData((prev) => ({
              ...prev,
              projectName: prev.projectName || empRecs[0].projectName,
            }));
          }
        }).catch(console.error);
      }

      // If opened from Monthly Archive with a specific date, pre-fill leave/exception forms for that day
      if (defaultDate) {
        setTab('leaves');
        setShowLeaveForm(true);
        setLeaveData(prev => ({
          ...prev,
          startDate: defaultDate,
          endDate: defaultDate
        }));
        setExceptionData(prev => ({
          ...prev,
          startDate: defaultDate,
          endDate: defaultDate
        }));
      } else {
        setLeaveData({ type: 'Annual', startDate: '', endDate: '', reason: '' });
        setExceptionData({ type: 'Permission', startDate: '', endDate: '', hours: '', reason: '' });
      }
      
      loadSubData();
    }
  }, [employee, defaultDate]);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGeneralData(prev => ({
      ...prev,
      [name]: name === 'dailyHours' || name === 'monthlySalary' ? Number(value) : value
    }));
  };

  const saveGeneralData = async () => {
    if (!employee) return;
    try {
      setLoading(true);
      await updateEmployee(employee.id, generalData);
      toast({ title: 'Success', description: 'Employee updated' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update employee', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Leave
  const submitLeave = async () => {
    if (!employee || !leaveData.startDate || !leaveData.endDate) {
      toast({ title: 'Required', description: 'Please fill start and end dates', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const newId = `leave_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await d1Client.setDoc('timesheetLeaves', newId, {
        id: newId,
        employeeId: employee.id,
        badgeId: employee.employeeId,
        name: employee.name,
        nameAr: employee.nameAr,
        ...leaveData,
        createdAt: new Date().toISOString()
      });
      // Optionally update employee status
      if (new Date() >= new Date(leaveData.startDate) && new Date() <= new Date(leaveData.endDate)) {
        await updateEmployee(employee.id, { status: 'On Leave' });
      }
      setShowLeaveForm(false);
      setLeaveData({ type: 'Annual', startDate: '', endDate: '', reason: '' });
      await loadSubData();
      toast({ title: 'Success', description: 'Leave recorded' });
    } catch(err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not save leave', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Transfer
  const submitTransfer = async () => {
    if (!employee || !transferData.date) {
      toast({ title: 'Required', description: 'Please fill transfer date / يرجى تحديد تاريخ التحويل', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const newId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await d1Client.setDoc('timesheetTransfers', newId, {
        id: newId,
        employeeId: employee.id,
        badgeId: employee.employeeId,
        name: employee.name,
        nameAr: employee.nameAr,
        ...transferData,
        createdAt: new Date().toISOString()
      });
      
      // Update employee location status
      const isOut = transferData.type === 'Move Out' || transferData.type === 'Change ID';
      await updateEmployee(employee.id, { 
        residenceStatus: isOut ? 'Outside' : 'Inside',
        residenceLocation: transferData.location || employee.residenceLocation || '',
        status: isOut ? 'Transferred' : 'Active',
        ...(isOut ? { transferDate: transferData.date } : { moveInDate: transferData.date })
      } as any);
      
      setShowTransferForm(false);
      setTransferData({ type: 'Move In', date: '', location: '', reason: '' });
      await loadSubData();
      toast({ title: 'Success', description: 'Transfer recorded successfully / تم تسجيل حركة التحويل بنجاح' });
    } catch(err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not save transfer', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Exception
  const submitException = async () => {
    if (!employee || !exceptionData.startDate || !exceptionData.endDate) {
      toast({ title: 'Required / مطلوب', description: 'Please fill start and end dates / يرجى كتابة تاريخ البداية والنهاية', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const newId = `exc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await d1Client.setDoc('timesheetExceptions', newId, {
        id: newId,
        employeeId: employee.id,
        badgeId: employee.employeeId,
        name: employee.name,
        nameAr: employee.nameAr,
        ...exceptionData,
        hours: Number(exceptionData.hours || 0),
        createdAt: new Date().toISOString()
      });

      setShowExceptionForm(false);
      setExceptionData({ type: 'Permission', startDate: '', endDate: '', hours: '', reason: '' });
      await loadSubData();
      toast({ title: 'Success / تم بنجاح', description: 'Exception recorded / تم تسجيل الاستثناء بنجاح' });
    } catch(err) {
      console.error(err);
      toast({ title: 'Error / خطأ', description: 'Could not save exception / تعذر حفظ الاستثناء', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Delete Exception
  const deleteException = async (id: string) => {
    try {
      setLoading(true);
      await d1Client.deleteDoc('timesheetExceptions', id);
      await loadSubData();
      toast({ title: 'Deleted / تم الحذف', description: 'Exception removed / تم حذف الاستثناء' });
    } catch(err) {
      console.error(err);
      toast({ title: 'Error / خطأ', description: 'Could not delete exception / تعذر حذف الاستثناء', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[750px] w-[95vw] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{generalData.nameAr || employee.nameAr} - {generalData.name || employee.name}</SheetTitle>
          <SheetDescription>Badge ID: {generalData.employeeId || employee.employeeId} | Role: {generalData.professionAr || employee.professionAr}</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full mt-4">
          <TabsList className="grid grid-cols-4 w-full text-xs md:text-sm">
            <TabsTrigger value="general">Profile / البيانات</TabsTrigger>
            <TabsTrigger value="leaves">Leaves / الإجازات</TabsTrigger>
            <TabsTrigger value="transfers">Transfers / التحويلات</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions / الاستثناءات</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-4 space-y-4">
            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-widest mb-4">Edit Profile Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name (Arabic)</Label>
                <Input name="nameAr" value={generalData.nameAr || ''} onChange={handleGeneralChange} />
              </div>
              <div className="space-y-2">
                <Label>Name (English)</Label>
                <Input name="name" value={generalData.name || ''} onChange={handleGeneralChange} />
              </div>

              <div className="space-y-2">
                <Label>Profession (Arabic)</Label>
                <Input name="professionAr" value={generalData.professionAr || ''} onChange={handleGeneralChange} />
              </div>
              <div className="space-y-2">
                <Label>Profession (English)</Label>
                <Input name="profession" value={generalData.profession || ''} onChange={handleGeneralChange} />
              </div>

              <div className="space-y-2">
                <Label>Employee ID (Badge)</Label>
                <Input name="employeeId" value={generalData.employeeId || ''} onChange={handleGeneralChange} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input name="department" value={generalData.department || ''} onChange={handleGeneralChange} />
              </div>

              <div className="space-y-2">
                <Label>Project / Residence</Label>
                <Input name="projectName" value={generalData.projectName || ''} onChange={handleGeneralChange} />
              </div>
            </div>

            <h3 className="font-medium text-sm text-gray-500 uppercase tracking-widest mt-6 mb-4">Employment Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Work Hours (RH)</Label>
                <Input name="dailyHours" type="number" value={generalData.dailyHours || 8} onChange={handleGeneralChange} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Salary (SR)</Label>
                <Input name="monthlySalary" type="number" value={generalData.monthlySalary || 0} onChange={handleGeneralChange} />
              </div>
              <div className="space-y-2">
                <Label>Employee Status</Label>
                <Select value={generalData.status || employee.status} onValueChange={(val) => setGeneralData(prev => ({ ...prev, status: val as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Transferred">Transferred</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Residence Status</Label>
                <Select value={generalData.residenceStatus || employee.residenceStatus || 'Inside'} onValueChange={(val) => setGeneralData(prev => ({ ...prev, residenceStatus: val as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inside">Inside Camp</SelectItem>
                    <SelectItem value="Outside">Outside Camp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={saveGeneralData} disabled={loading}>
              {loading ? 'Saving...' : 'Update Details'}
            </Button>
          </TabsContent>
          
          <TabsContent value="leaves" className="mt-4">
            <div className="rounded-md border p-4 bg-gray-50 dark:bg-gray-900 mb-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Request New Leave / إضافة إجازة</p>
                <p className="text-xs text-gray-500">Add sick or annual leave</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowLeaveForm(!showLeaveForm)}>
                {showLeaveForm ? 'Cancel' : '+ New Leave'}
              </Button>
            </div>

            {showLeaveForm && (
              <div className="bg-white dark:bg-gray-950 border p-4 rounded-md mb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Select value={leaveData.type} onValueChange={(val) => setLeaveData(prev => ({ ...prev, type: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Annual">Annual Leave / إجازة سنوية</SelectItem>
                        <SelectItem value="Sick">Sick Leave / إجازة مرضية</SelectItem>
                        <SelectItem value="Emergency">Emergency Leave / إجازة اضطرارية</SelectItem>
                        <SelectItem value="Unpaid">Unpaid / بدون راتب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (Optional)</Label>
                    <Input value={leaveData.reason} onChange={(e) => setLeaveData(p => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={leaveData.startDate} onChange={(e) => setLeaveData(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={leaveData.endDate} onChange={(e) => setLeaveData(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={submitLeave} disabled={loading}>Submit Leave Request</Button>
              </div>
            )}

            {leaves.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border rounded">
                No leave records found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.map((lv) => (
                  <div key={lv.id} className="border flex items-center justify-between p-3 rounded-md bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${lv.type === 'Sick' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{lv.type} Leave</p>
                        <p className="text-xs text-gray-500">{lv.startDate} to {lv.endDate}</p>
                      </div>
                    </div>
                    {lv.reason && <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{lv.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transfers" className="mt-4">
            <div className="rounded-md border p-4 bg-gray-50 dark:bg-gray-900 mb-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Transfer Employee / تحويلات الموظف وتغيير الأرقام</p>
                <p className="text-xs text-gray-500">سجل حركات النقل الداخلي/الخارجي وتغيير الأرقام الوظيفية (لتمثيل علامة T في الأرشيف)</p>
              </div>
              <Button size="sm" variant="outline" className="text-blue-600" onClick={() => setShowTransferForm(!showTransferForm)}>
                {showTransferForm ? 'Cancel' : '+ New Transfer / تسجيل حركة تحويل'}
              </Button>
            </div>

            {showTransferForm && (
              <div className="bg-white dark:bg-gray-950 border p-4 rounded-md mb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع الحركة / Transfer Type</Label>
                    <Select value={transferData.type} onValueChange={(val) => setTransferData(prev => ({ ...prev, type: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Move Out">Move Out / نقل وخروج (T للأيام التالية للرقم القديم)</SelectItem>
                        <SelectItem value="Move In">Move In / انضمام ورقم جديد (T للأيام السابقة للرقم الجديد)</SelectItem>
                        <SelectItem value="Change ID">Change Employee ID / تغيير رقم وظيفي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الحركة / Transfer Date</Label>
                    <Input type="date" value={transferData.date} onChange={(e) => setTransferData(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>الموقع أو السكن أو الرقم المرتبط / Target Location / Project / Related Badge</Label>
                    <Input value={transferData.location} onChange={(e) => setTransferData(p => ({ ...p, location: e.target.value }))} placeholder="مثال: تم التغيير من الرقم 35440 إلى 51500 أو اسم السكن الجديد" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>ملاحظات أو سبب التحويل / Notes & Reason</Label>
                    <Input value={transferData.reason} onChange={(e) => setTransferData(p => ({ ...p, reason: e.target.value }))} placeholder="مثال: إصدار إقامة جديدة / تغيير الرقم الوظيفي المعتمد" />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded border border-blue-100 dark:border-blue-900">
                  💡 <strong>ملاحظة:</strong> عند اختيار <strong>Move Out</strong> سيقوم الأرشيف الشهري بوضع رمز <code>T</code> لجميع الأيام من تاريخ التحويل فصاعداً. وعند اختيار <strong>Move In</strong> سيضع رمز <code>T</code> لجميع الأيام السابقة لتاريخ التحويل.
                </div>
                <Button className="w-full" onClick={submitTransfer} disabled={loading}>حفظ حركة التحويل (Submit Transfer)</Button>
              </div>
            )}

            {transfers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border rounded">
                No transfer history found / لا توجد سجلات تحويل سابقة لهذا الموظف.
              </div>
            ) : (
               <div className="space-y-3">
                {transfers.map((tr) => (
                  <div key={tr.id} className="border flex items-center justify-between p-3 rounded-md bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${tr.type === 'Move In' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        <Plane className={`h-4 w-4 ${tr.type === 'Move Out' || tr.type === 'Change ID' ? 'rotate-45' : 'rotate-[135deg]'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tr.type} <span className="text-gray-400 font-normal">({tr.date})</span></p>
                        <p className="text-xs text-gray-500">{tr.location || 'Unknown Location'}</p>
                      </div>
                    </div>
                    {tr.reason && <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{tr.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <div className="rounded-md border p-4 bg-gray-50 dark:bg-gray-900 mb-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Employee Exceptions / استثناءات الموظف</p>
                <p className="text-xs text-gray-500">Record permissions, delay excuses, work exemptions & manual adjustments</p>
              </div>
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400" onClick={() => setShowExceptionForm(!showExceptionForm)}>
                {showExceptionForm ? 'Cancel / إلغاء' : '+ New Exception / استثناء جديد'}
              </Button>
            </div>

            {showExceptionForm && (
              <div className="bg-white dark:bg-gray-950 border p-4 rounded-md mb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Exception Type / نوع الاستثناء</Label>
                    <Select value={exceptionData.type} onValueChange={(val) => setExceptionData(prev => ({ ...prev, type: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Permission">Permission / استئذان (إذن دوام)</SelectItem>
                        <SelectItem value="Delay Excuse">Delay Excuse / عذر تأخير</SelectItem>
                        <SelectItem value="Work Exemption">Work Exemption / إعفاء من الدوام</SelectItem>
                        <SelectItem value="Reduced Hours">Reduced Hours / ساعات دوام مخفضة</SelectItem>
                        <SelectItem value="Overtime Approval">Overtime Approval / اعتماد ساعات إضافية</SelectItem>
                        <SelectItem value="Duty Exception">Duty Exception / استثناء طبيعة عمل</SelectItem>
                        <SelectItem value="Other">Other Exception / استثناء آخر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hours (Optional) / الساعات (إن وجدت)</Label>
                    <Input 
                      type="number" 
                      step="0.5" 
                      placeholder="مثال: 2, 4, 8" 
                      value={exceptionData.hours} 
                      onChange={(e) => setExceptionData(p => ({ ...p, hours: e.target.value }))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date / تاريخ البداية</Label>
                    <Input type="date" value={exceptionData.startDate} onChange={(e) => setExceptionData(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date / تاريخ النهاية</Label>
                    <Input type="date" value={exceptionData.endDate} onChange={(e) => setExceptionData(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Reason or Notes / السبب أو الملاحظات</Label>
                    <Input 
                      value={exceptionData.reason} 
                      onChange={(e) => setExceptionData(p => ({ ...p, reason: e.target.value }))} 
                      placeholder="سبب الاستثناء أو الملاحظات التفصيلية..."
                    />
                  </div>
                </div>
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={submitException} disabled={loading}>
                  {loading ? 'Saving... / جاري الحفظ...' : 'Submit Exception Record / حفظ الاستثناء'}
                </Button>
              </div>
            )}

            {exceptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border rounded">
                No exception records found for this employee. / لا توجد استثناءات مسجلة لهذا الموظف.
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((ex) => (
                  <div key={ex.id} className="border flex items-center justify-between p-3 rounded-md bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{ex.type}</p>
                          {ex.hours > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold">
                              {ex.hours} hrs
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{ex.startDate} {ex.startDate !== ex.endDate ? `to ${ex.endDate}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ex.reason && <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded max-w-[200px] truncate">{ex.reason}</span>}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteException(ex.id)} title="Delete Exception">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

