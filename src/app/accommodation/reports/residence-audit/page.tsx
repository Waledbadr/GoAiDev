"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useAccommodation } from '@/context/accommodation-context';
import { useUsers } from '@/context/users-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Users,
  DoorClosed,
  Bed,
  Printer,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck2,
  Building,
  UserCheck,
  Compass,
  PieChart,
  Briefcase,
  Globe2,
  ShieldCheck,
  FileText,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export default function ResidenceAuditReportPage() {
  const { residences, workers, occupants, loading, refresh } = useAccommodation();
  const { currentUser } = useUsers();

  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'all_residences'>('summary');
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('ALL');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OCCUPIED' | 'VACANT' | 'OVERCROWDED'>('ALL');
  const [checkedRoomIds, setCheckedRoomIds] = useState<Record<string, boolean>>({});

  // Active residences list
  const activeResidences = useMemo(() => {
    return (residences || []).filter((r: any) => !r.disabled && r.name);
  }, [residences]);

  // Set default residence if not selected
  React.useEffect(() => {
    if (!selectedResidenceId && activeResidences.length > 0) {
      setSelectedResidenceId(activeResidences[0].id);
    }
  }, [selectedResidenceId, activeResidences]);

  // Currently selected residence object
  const currentResidence = useMemo(() => {
    return activeResidences.find((r) => r.id === selectedResidenceId);
  }, [activeResidences, selectedResidenceId]);

  // Active occupants map for quick lookups
  const occupantsByRoomId = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const occ of occupants) {
      if (occ.until) continue; // Skip checked out
      if (!map[occ.roomId]) map[occ.roomId] = [];
      map[occ.roomId].push(occ);
    }
    return map;
  }, [occupants]);

  // Workers map
  const workersById = useMemo(() => {
    const map = new Map<string, any>();
    for (const w of workers) {
      map.set(w.id, w);
    }
    return map;
  }, [workers]);

  // Build hierarchical structure of current residence
  const auditData = useMemo(() => {
    if (!currentResidence) return null;

    let totalBuildings = 0;
    let totalFloors = 0;
    let totalRooms = 0;
    let totalCapacity = 0;
    let totalOccupied = 0;
    let totalVacantBeds = 0;
    let totalOccupiedRooms = 0;
    let totalVacantRooms = 0;
    let overcrowdedRoomsCount = 0;

    const buildingsList: any[] = [];
    const buildingsSummaryList: any[] = [];

    const companyStats: Record<string, { count: number; sponsors: Set<string>; buildings: Set<string> }> = {};
    const nationalityStats: Record<string, number> = {};
    const occupationStats: Record<string, number> = {};
    const projectStats: Record<string, number> = {};

    const query = searchQuery.trim().toLowerCase();
    const buildings = currentResidence.buildings || [];

    for (const bldg of buildings) {
      const bldgRooms: any[] = [];
      let bldgCapacity = 0;
      let bldgOccupied = 0;
      let bldgOccupiedRooms = 0;
      let bldgVacantRooms = 0;
      const bldgCompanies = new Set<string>();
      const bldgNationalities = new Set<string>();

      const floorsList: any[] = [];
      const floors = bldg.floors || [];

      for (const fl of floors) {
        const roomsList: any[] = [];
        const rooms = fl.rooms || [];

        for (const rm of rooms) {
          totalRooms++;
          const capacity = Number(rm.capacity || 4);
          bldgCapacity += capacity;
          totalCapacity += capacity;

          // Find active occupants for this room
          const roomOccs = occupantsByRoomId[rm.id] || [];
          const occupiedCount = roomOccs.length;
          bldgOccupied += occupiedCount;
          totalOccupied += occupiedCount;

          const vacantBeds = Math.max(0, capacity - occupiedCount);
          totalVacantBeds += vacantBeds;

          const isOvercrowded = occupiedCount > capacity;
          if (isOvercrowded) overcrowdedRoomsCount++;

          const isVacant = occupiedCount === 0;
          if (isVacant) {
            totalVacantRooms++;
            bldgVacantRooms++;
          } else {
            totalOccupiedRooms++;
            bldgOccupiedRooms++;
          }

          // Enrich occupants with worker data
          const roomWorkers = roomOccs.map((occ: any) => {
            const w = workersById.get(occ.workerId) || {};
            const comp = w.company || 'SACODECO';
            const spons = w.sponsor || '-';
            const nat = w.nationality || w.nationaliy || 'غير محدد';
            const occu = w.occupation || w.role || 'عامل';
            const proj = w.project || w.currentProject || 'عام';

            bldgCompanies.add(comp);
            bldgNationalities.add(nat);

            // Global stats for residence
            if (!companyStats[comp]) companyStats[comp] = { count: 0, sponsors: new Set(), buildings: new Set() };
            companyStats[comp].count++;
            if (spons && spons !== '-') companyStats[comp].sponsors.add(spons);
            companyStats[comp].buildings.add(bldg.name || 'مبنى');

            nationalityStats[nat] = (nationalityStats[nat] || 0) + 1;
            occupationStats[occu] = (occupationStats[occu] || 0) + 1;
            projectStats[proj] = (projectStats[proj] || 0) + 1;

            return {
              occupantId: occ.id,
              workerId: occ.workerId,
              name: occ.workerName || w.name || 'عامل غير مسجل',
              employeeId: w.employeeId || '',
              idNumber: w.idNumber || '',
              nationality: nat,
              company: comp,
              occupation: occu,
              department: w.department || '',
              project: proj,
              sponsor: spons,
              since: occ.since || '',
              notes: occ.notes || '',
            };
          });

          // Filter by status for detailed list
          if (statusFilter === 'OCCUPIED' && isVacant) continue;
          if (statusFilter === 'VACANT' && !isVacant) continue;
          if (statusFilter === 'OVERCROWDED' && !isOvercrowded) continue;

          // Filter by search query
          if (query) {
            const matchRoom = (rm.name || rm.id || '').toLowerCase().includes(query);
            const matchWorker = roomWorkers.some(
              (w: any) =>
                w.name.toLowerCase().includes(query) ||
                w.employeeId.toLowerCase().includes(query) ||
                w.idNumber.toLowerCase().includes(query) ||
                w.nationality.toLowerCase().includes(query) ||
                w.company.toLowerCase().includes(query)
            );
            if (!matchRoom && !matchWorker) continue;
          }

          const roomItem = {
            roomId: rm.id,
            roomName: rm.name || rm.id,
            capacity,
            occupiedCount,
            vacantBeds,
            isOvercrowded,
            isVacant,
            workers: roomWorkers,
          };

          roomsList.push(roomItem);
          bldgRooms.push(roomItem);
        }

        if (roomsList.length > 0 || (!query && selectedFloorId === 'ALL')) {
          if (selectedFloorId === 'ALL' || fl.id === selectedFloorId) {
            floorsList.push({
              floorId: fl.id,
              floorName: fl.name || 'طابق عام',
              rooms: roomsList,
            });
          }
        }
      }

      const bldgRate = bldgCapacity > 0 ? Math.round((bldgOccupied / bldgCapacity) * 100) : 0;

      buildingsSummaryList.push({
        buildingId: bldg.id,
        buildingName: bldg.name || 'مبنى عام',
        floorsCount: floors.length,
        roomsCount: bldgRooms.length,
        occupiedRooms: bldgOccupiedRooms,
        vacantRooms: bldgVacantRooms,
        capacity: bldgCapacity,
        occupied: bldgOccupied,
        vacantBeds: Math.max(0, bldgCapacity - bldgOccupied),
        occupancyRate: bldgRate,
        companies: Array.from(bldgCompanies),
        nationalities: Array.from(bldgNationalities),
      });

      if (selectedBuildingId === 'ALL' || bldg.id === selectedBuildingId) {
        totalBuildings++;
        totalFloors += floorsList.length;
        if (floorsList.length > 0 || !query) {
          buildingsList.push({
            buildingId: bldg.id,
            buildingName: bldg.name || 'مبنى عام',
            floors: floorsList,
          });
        }
      }
    }

    const rate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    return {
      totalBuildings: buildings.length,
      totalFloors: buildings.reduce((acc, b) => acc + (b.floors?.length || 0), 0),
      totalRooms,
      totalOccupiedRooms,
      totalVacantRooms,
      totalCapacity,
      totalOccupied,
      totalVacantBeds,
      overcrowdedRoomsCount,
      occupancyRate: rate,
      buildings: buildingsList,
      buildingsSummary: buildingsSummaryList,
      companyBreakdown: Object.entries(companyStats).map(([comp, d]) => ({
        company: comp,
        count: d.count,
        percentage: totalOccupied > 0 ? Math.round((d.count / totalOccupied) * 100) : 0,
        sponsors: Array.from(d.sponsors),
        buildings: Array.from(d.buildings),
      })).sort((a, b) => b.count - a.count),
      nationalityBreakdown: Object.entries(nationalityStats).map(([nat, count]) => ({
        nationality: nat,
        count,
        percentage: totalOccupied > 0 ? Math.round((count / totalOccupied) * 100) : 0,
      })).sort((a, b) => b.count - a.count),
      occupationBreakdown: Object.entries(occupationStats).map(([occ, count]) => ({
        occupation: occ,
        count,
      })).sort((a, b) => b.count - a.count),
      projectBreakdown: Object.entries(projectStats).map(([proj, count]) => ({
        project: proj,
        count,
      })).sort((a, b) => b.count - a.count),
    };
  }, [
    currentResidence,
    selectedBuildingId,
    selectedFloorId,
    searchQuery,
    statusFilter,
    occupantsByRoomId,
    workersById,
  ]);

  // Comparison Summary for All Residences
  const allResidencesComparison = useMemo(() => {
    let grandCapacity = 0;
    let grandOccupied = 0;
    let grandRooms = 0;
    let grandBuildings = 0;

    const list = activeResidences.map((res: any) => {
      const buildings = res.buildings || [];
      let capacity = 0;
      let roomsCount = 0;

      for (const b of buildings) {
        for (const fl of b.floors || []) {
          for (const rm of fl.rooms || []) {
            roomsCount++;
            capacity += Number(rm.capacity || 4);
          }
        }
      }

      const activeOccs = occupants.filter((o) => !o.until && (o.residenceId === res.id || (o as any).residenceName === res.name));
      const occupied = activeOccs.length;
      const vacantBeds = Math.max(0, capacity - occupied);
      const rate = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

      grandCapacity += capacity;
      grandOccupied += occupied;
      grandRooms += roomsCount;
      grandBuildings += buildings.length;

      return {
        id: res.id,
        name: res.name,
        city: res.city || '-',
        buildingsCount: buildings.length,
        roomsCount,
        capacity,
        occupied,
        vacantBeds,
        rate,
      };
    }).sort((a, b) => b.occupied - a.occupied);

    const grandRate = grandCapacity > 0 ? Math.round((grandOccupied / grandCapacity) * 100) : 0;

    return {
      grandBuildings,
      grandRooms,
      grandCapacity,
      grandOccupied,
      grandVacantBeds: Math.max(0, grandCapacity - grandOccupied),
      grandRate,
      list,
    };
  }, [activeResidences, occupants]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!currentResidence || !auditData) return;

    const headers = [
      'السكن',
      'المبنى',
      'الطابق',
      'الغرفة',
      'طاقة الغرفة',
      'عدد الساكنين',
      'الرقم الوظيفي',
      'اسم العامل',
      'رقم الإقامة / الهوية',
      'الجنسية',
      'المهنة',
      'الشركة',
      'الكفيل',
      'المشروع',
      'تاريخ الدخول',
      'الملاحظات',
    ];

    const rows: string[][] = [];

    for (const bldg of auditData.buildings) {
      for (const fl of bldg.floors) {
        for (const rm of fl.rooms) {
          if (rm.workers.length === 0) {
            rows.push([
              currentResidence.name,
              bldg.buildingName,
              fl.floorName,
              rm.roomName,
              String(rm.capacity),
              '0',
              '-',
              'غرفة شاغرة',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
            ]);
          } else {
            for (const w of rm.workers) {
              rows.push([
                currentResidence.name,
                bldg.buildingName,
                fl.floorName,
                rm.roomName,
                String(rm.capacity),
                String(rm.occupiedCount),
                w.employeeId,
                w.name,
                w.idNumber,
                w.nationality,
                w.occupation,
                w.company,
                w.sponsor,
                w.project,
                w.since,
                w.notes,
              ]);
            }
          }
        }
      }
    }

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `تقرير_تسكين_${currentResidence.name}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleRoomCheck = (roomId: string) => {
    setCheckedRoomIds((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto print:p-0 print:space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4 print:border-none">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/accommodation/reports"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 print:hidden"
            >
              <ArrowRight className="h-3 w-3" /> العودة للتقارير
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <FileCheck2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400 print:hidden" />
            تقرير مراجعة ومطابقة السكن الميداني
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ملخص تنفيذي وتدقيق تفصيلي لمطابقة الواقع مع النظام (المباني، الغرف، الطاقة الاستيعابية، والعمالة الساكنة).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> تصدير Excel (CSV)
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="h-4 w-4" /> طباعة التقرير
          </Button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block border-b-2 border-black pb-4 text-center">
        <h2 className="text-2xl font-bold">SACODECO | شركة مواد الإعمار السعودية</h2>
        <h3 className="text-lg font-semibold mt-1">
          تقرير التدقيق والمطابقة الميدانية لسكن: {currentResidence?.name} ({currentResidence?.city})
        </h3>
        <div className="flex justify-between items-center text-xs mt-2 text-gray-600">
          <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')} - {new Date().toLocaleTimeString()}</span>
          <span>المسؤول الميداني: {currentUser?.name || 'مشرف السكن'}</span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 print:hidden">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList className="grid grid-cols-3 w-full sm:w-[500px]">
              <TabsTrigger value="summary" className="gap-1.5 text-xs font-semibold">
                <BarChart3 className="h-3.5 w-3.5" />
                الملخص التنفيذي
              </TabsTrigger>
              <TabsTrigger value="detailed" className="gap-1.5 text-xs font-semibold">
                <FileText className="h-3.5 w-3.5" />
                الكشف التفصيلي للغرف
              </TabsTrigger>
              <TabsTrigger value="all_residences" className="gap-1.5 text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5" />
                مقارنة جميع السكنات
              </TabsTrigger>
            </TabsList>

            {/* Quick Residence Selector */}
            {activeTab !== 'all_residences' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold shrink-0 text-muted-foreground">السكن المحدد:</Label>
                <Select value={selectedResidenceId} onValueChange={(val) => setSelectedResidenceId(val)}>
                  <SelectTrigger className="h-8 text-xs font-semibold w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeResidences.map((res) => (
                      <SelectItem key={res.id} value={res.id}>
                        {res.name} ({res.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Summary KPI Cards for Selected Residence */}
      {activeTab !== 'all_residences' && auditData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3 border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
              <Building2 className="h-4 w-4" /> المباني
            </div>
            <div className="text-2xl font-bold mt-1 text-indigo-900 dark:text-indigo-100">
              {auditData.totalBuildings}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{auditData.totalFloors} طوابق</div>
          </Card>

          <Card className="p-3 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <DoorClosed className="h-4 w-4 text-primary" /> إجمالي الغرف
            </div>
            <div className="text-2xl font-bold mt-1">{auditData.totalRooms}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {auditData.totalOccupiedRooms} مسكونة / {auditData.totalVacantRooms} شاغرة
            </div>
          </Card>

          <Card className="p-3 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Bed className="h-4 w-4 text-emerald-600" /> الطاقة الاستيعابية
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {auditData.totalCapacity}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">مكان / سرير</div>
          </Card>

          <Card className="p-3 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Users className="h-4 w-4 text-blue-600" /> العمالة الساكنة
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
              {auditData.totalOccupied}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">عامل مسكن حالياً</div>
          </Card>

          <Card className="p-3 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Bed className="h-4 w-4 text-amber-600" /> الأسرة الشاغرة
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              {auditData.totalVacantBeds}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">شاغر متاح</div>
          </Card>

          <Card className="p-3 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Compass className="h-4 w-4 text-purple-600" /> نسبة الإشغال
            </div>
            <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
              {auditData.occupancyRate}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {auditData.overcrowdedRoomsCount > 0 ? `${auditData.overcrowdedRoomsCount} غرفة مكتظة` : 'طبيعي'}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 1: EXECUTIVE SUMMARY */}
      {activeTab === 'summary' && auditData && (
        <div className="space-y-6">
          {/* Buildings Summary Table */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                ملخص مباني سكن {currentResidence?.name}
              </CardTitle>
              <CardDescription className="text-xs">
                مقارنة الطاقة الاستيعابية والإشغال ونسب الشواغر في كل مبنى
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                    <TableHead className="font-bold">اسم المبنى</TableHead>
                    <TableHead className="text-center">الطوابق</TableHead>
                    <TableHead className="text-center">إجمالي الغرف</TableHead>
                    <TableHead className="text-center">الغرف المسكونة</TableHead>
                    <TableHead className="text-center">الغرف الشاغرة</TableHead>
                    <TableHead className="text-center font-bold text-emerald-700 dark:text-emerald-400">السعة (سرير)</TableHead>
                    <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400">العمالة الساكنة</TableHead>
                    <TableHead className="text-center font-bold text-amber-700 dark:text-amber-400">الشواغر</TableHead>
                    <TableHead className="w-36 text-center">نسبة الإشغال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditData.buildingsSummary.map((b, idx) => (
                    <TableRow key={b.buildingId} className="hover:bg-muted/30">
                      <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-indigo-700 dark:text-indigo-300">
                        مبنى: {b.buildingName}
                      </TableCell>
                      <TableCell className="text-center font-mono">{b.floorsCount}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{b.roomsCount}</TableCell>
                      <TableCell className="text-center font-mono text-blue-600">{b.occupiedRooms}</TableCell>
                      <TableCell className="text-center font-mono text-amber-600">{b.vacantRooms}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-emerald-600">{b.capacity}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-blue-600">{b.occupied}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-amber-600">{b.vacantBeds}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-mono font-semibold">{b.occupancyRate}%</span>
                          </div>
                          <Progress value={Math.min(100, b.occupancyRate)} className="h-1.5" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Breakdown Grids: Companies & Nationalities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Companies Breakdown */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-cyan-600" />
                  ملخص الشركات والكفلاء في السكن
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>الشركة</TableHead>
                      <TableHead className="text-center">عدد العمال</TableHead>
                      <TableHead className="text-center">النسبة</TableHead>
                      <TableHead>المباني المشغولة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.companyBreakdown.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold">{item.company}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.count}
                        </TableCell>
                        <TableCell className="text-center font-mono">{item.percentage}%</TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {item.buildings.slice(0, 4).join(', ')}
                          {item.buildings.length > 4 ? ` (+${item.buildings.length - 4})` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Nationalities Breakdown */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-purple-600" />
                  ملخص توزيع الجنسيات في السكن
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>الجنسية</TableHead>
                      <TableHead className="text-center">عدد العمال</TableHead>
                      <TableHead className="w-32 text-center">النسبة المئوية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.nationalityBreakdown.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold">{item.nationality}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-purple-600">
                          {item.count}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="font-mono">{item.percentage}%</span>
                            </div>
                            <Progress value={item.percentage} className="h-1.5" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED FIELD AUDIT */}
      {activeTab === 'detailed' && (
        <div className="space-y-4">
          {/* Filters Bar for Detailed View */}
          <Card className="border border-border/80 shadow-sm print:hidden">
            <CardContent className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">المبنى</Label>
                  <Select
                    value={selectedBuildingId}
                    onValueChange={(val) => {
                      setSelectedBuildingId(val);
                      setSelectedFloorId('ALL');
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="كل المباني" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">كل المباني ({currentResidence?.buildings?.length || 0})</SelectItem>
                      {(currentResidence?.buildings || []).map((bldg: any) => (
                        <SelectItem key={bldg.id} value={bldg.id}>
                          مبنى: {bldg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">حالة الغرفة</Label>
                  <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع الغرف</SelectItem>
                      <SelectItem value="OCCUPIED">الغرف المسكونة فقط</SelectItem>
                      <SelectItem value="VACANT">الغرف الشاغرة فقط</SelectItem>
                      <SelectItem value="OVERCROWDED">الغرف المكتظة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">بحث سريع</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="رقم الموظف، الاسم، رقم الغرفة، الجنسية..."
                      className="h-8 pr-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Hierarchical Buildings & Rooms View */}
          {auditData && auditData.buildings.length > 0 ? (
            <div className="space-y-6">
              {auditData.buildings.map((bldg: any) => (
                <Card key={bldg.buildingId} className="border border-border/80 overflow-hidden shadow-sm break-inside-avoid">
                  <CardHeader className="bg-muted/40 py-2.5 px-4 border-b border-border/60 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <CardTitle className="text-base font-bold">مبنى: {bldg.buildingName}</CardTitle>
                      <Badge variant="outline" className="text-xs font-mono">
                        {bldg.floors.reduce((acc: number, f: any) => acc + f.rooms.length, 0)} غرفة
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>
                        إجمالي العمال:{' '}
                        <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                          {bldg.floors.reduce(
                            (acc: number, f: any) =>
                              acc + f.rooms.reduce((rAcc: number, rm: any) => rAcc + rm.occupiedCount, 0),
                            0
                          )}
                        </strong>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0 divide-y divide-border/60">
                    {bldg.floors.map((fl: any) => (
                      <div key={fl.floorId} className="p-4 space-y-3">
                        <div className="flex items-center justify-between bg-muted/20 px-3 py-1.5 rounded-lg border border-border/40">
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            <span>طابق: {fl.floorName}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {fl.rooms.length} غرفة مسجلة بهذا الطابق
                          </span>
                        </div>

                        {/* Rooms List */}
                        <div className="space-y-4">
                          {fl.rooms.map((rm: any) => (
                            <div
                              key={rm.roomId}
                              className={`rounded-lg border transition-all ${
                                checkedRoomIds[rm.roomId]
                                  ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/40'
                                  : rm.isOvercrowded
                                  ? 'bg-red-50/20 dark:bg-red-950/10 border-red-500/30'
                                  : 'bg-card border-border/60'
                              }`}
                            >
                              {/* Room Header Row */}
                              <div className="flex flex-wrap items-center justify-between p-3 border-b border-border/40 gap-2 bg-muted/10">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`check-${rm.roomId}`}
                                    checked={!!checkedRoomIds[rm.roomId]}
                                    onCheckedChange={() => toggleRoomCheck(rm.roomId)}
                                    className="print:hidden"
                                  />
                                  <Label
                                    htmlFor={`check-${rm.roomId}`}
                                    className="font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <DoorClosed className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    <span>غرفة رقم: {rm.roomName}</span>
                                  </Label>

                                  {rm.isOvercrowded && (
                                    <Badge variant="destructive" className="text-[10px] gap-1 py-0">
                                      <AlertTriangle className="h-2.5 w-2.5" /> زيادة عن الطاقة
                                    </Badge>
                                  )}
                                  {rm.isVacant && (
                                    <Badge variant="secondary" className="text-[10px] py-0 text-muted-foreground">
                                      شاغرة بالكامل
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span>
                                    السعة: <strong className="font-mono">{rm.capacity}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    المسكنين:{' '}
                                    <strong
                                      className={`font-mono ${
                                        rm.isOvercrowded
                                          ? 'text-red-600 font-bold'
                                          : rm.occupiedCount > 0
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      {rm.occupiedCount}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    الشاغر:{' '}
                                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                      {rm.vacantBeds}
                                    </strong>
                                  </span>

                                  <div className="hidden print:inline-block border border-black px-2 py-0.5 text-[10px]">
                                    مطابق ميدانياً: [ &nbsp; ]
                                  </div>
                                </div>
                              </div>

                              {/* Occupants Table */}
                              {rm.workers.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <Table className="text-xs">
                                    <TableHeader>
                                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead className="w-24">الرقم الوظيفي</TableHead>
                                        <TableHead>اسم العامل</TableHead>
                                        <TableHead className="w-28">رقم الإقامة / الهوية</TableHead>
                                        <TableHead className="w-24">الجنسية</TableHead>
                                        <TableHead className="w-28">المهنة</TableHead>
                                        <TableHead className="w-28">الشركة / الكفيل</TableHead>
                                        <TableHead className="w-24">تاريخ الدخول</TableHead>
                                        <TableHead className="w-32">الملاحظات</TableHead>
                                        <TableHead className="w-24 text-center print:table-cell">المطابقة</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {rm.workers.map((w: any, idx: number) => (
                                        <TableRow key={w.occupantId || idx} className="hover:bg-muted/30">
                                          <TableCell className="text-center font-mono text-muted-foreground">
                                            {idx + 1}
                                          </TableCell>
                                          <TableCell className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                            {w.employeeId || '-'}
                                          </TableCell>
                                          <TableCell className="font-medium">{w.name}</TableCell>
                                          <TableCell className="font-mono">{w.idNumber || '-'}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className="text-[10px] font-normal">
                                              {w.nationality}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>{w.occupation || '-'}</TableCell>
                                          <TableCell className="text-muted-foreground truncate max-w-[120px]" title={w.company}>
                                            {w.company || w.sponsor || '-'}
                                          </TableCell>
                                          <TableCell className="font-mono text-[11px]">{w.since || '-'}</TableCell>
                                          <TableCell className="text-muted-foreground text-[11px] truncate max-w-[140px]" title={w.notes}>
                                            {w.notes || '-'}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <span className="hidden print:inline-block font-mono text-xs">
                                              [ &nbsp; ] موجود
                                            </span>
                                            <span className="print:hidden text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                                              <UserCheck className="h-3.5 w-3.5" /> ساكن
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <div className="p-3 text-center text-xs text-muted-foreground italic">
                                  لا يوجد عمالة مسكنة في هذه الغرفة حالياً (شاغرة).
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground space-y-2">
              <Building className="h-10 w-10 mx-auto opacity-30" />
              <div className="text-base font-semibold">لا توجد بيانات مطابقة للخيارات المحددة</div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: ALL RESIDENCES COMPARISON */}
      {activeTab === 'all_residences' && (
        <div className="space-y-6">
          {/* Summary KPIs Across All Residences */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3 border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Building2 className="h-4 w-4" /> إجمالي السكنات
              </div>
              <div className="text-2xl font-bold mt-1 text-indigo-900 dark:text-indigo-100">
                {activeResidences.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{allResidencesComparison.grandBuildings} مبنى</div>
            </Card>

            <Card className="p-3 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                <DoorClosed className="h-4 w-4 text-primary" /> إجمالي الغرف
              </div>
              <div className="text-2xl font-bold mt-1">{allResidencesComparison.grandRooms}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">غرفة مسجلة</div>
            </Card>

            <Card className="p-3 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                <Bed className="h-4 w-4 text-emerald-600" /> الطاقة الاستيعابية
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {allResidencesComparison.grandCapacity}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">سرير متاح</div>
            </Card>

            <Card className="p-3 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                <Users className="h-4 w-4 text-blue-600" /> إجمالي المسكنين
              </div>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {allResidencesComparison.grandOccupied}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">عامل ساكن حالياً</div>
            </Card>

            <Card className="p-3 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                <Bed className="h-4 w-4 text-amber-600" /> الشواغر الكلية
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {allResidencesComparison.grandVacantBeds}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">سرير شاغر</div>
            </Card>

            <Card className="p-3 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                <Compass className="h-4 w-4 text-purple-600" /> نسبة الإشغال العامة
              </div>
              <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                {allResidencesComparison.grandRate}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">في جميع السكنات</div>
            </Card>
          </div>

          {/* All Residences Table */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                جدول مقارنة السكنات والمجمعات السكنية
              </CardTitle>
              <CardDescription className="text-xs">
                مقارنة شاملة لجميع السكنات لمعرفة التوزيع والطاقة الاستيعابية ونسب الإشغال
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                    <TableHead className="font-bold">المجمع السكني</TableHead>
                    <TableHead>المدينة</TableHead>
                    <TableHead className="text-center">المباني</TableHead>
                    <TableHead className="text-center">الغرف</TableHead>
                    <TableHead className="text-center font-bold text-emerald-700 dark:text-emerald-400">السعة (سرير)</TableHead>
                    <TableHead className="text-center font-bold text-blue-700 dark:text-blue-400">العمالة الساكنة</TableHead>
                    <TableHead className="text-center font-bold text-amber-700 dark:text-amber-400">الشواغر</TableHead>
                    <TableHead className="w-40 text-center">نسبة الإشغال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allResidencesComparison.list.map((r, idx) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        setSelectedResidenceId(r.id);
                        setActiveTab('summary');
                      }}
                    >
                      <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-indigo-700 dark:text-indigo-300">
                        {r.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.city}</TableCell>
                      <TableCell className="text-center font-mono">{r.buildingsCount}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{r.roomsCount}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-emerald-600">{r.capacity}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-blue-600">{r.occupied}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-amber-600">{r.vacantBeds}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-mono font-semibold">{r.rate}%</span>
                          </div>
                          <Progress value={Math.min(100, r.rate)} className="h-1.5" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Field Audit Sign-Off Box (Print only) */}
      <div className="hidden print:block border-2 border-gray-800 rounded-lg p-4 mt-8 break-inside-avoid">
        <h4 className="font-bold text-sm border-b border-gray-400 pb-1 mb-3">
          إقرار واعتماد المطابقة الميدانية للسكن:
        </h4>
        <p className="text-xs text-gray-700 leading-relaxed mb-6">
          أقر أنا مسؤول / مشرف السكن الموضح أدناه بأنه تمت مطابقة وفحص الغرف والعمالة الساكنة فعلياً على أرض الواقع مع
          كشف النظام أعلاه، وتم تدوين أي ملاحظات أو فروقات إن وجدت.
        </p>
        <div className="grid grid-cols-3 gap-6 text-xs font-semibold pt-4">
          <div>
            اسم مسؤول السكن: ______________________
            <div className="mt-2 text-gray-500 font-normal">التوقيع: __________________</div>
          </div>
          <div>
            اسم المدقق الميداني: ___________________
            <div className="mt-2 text-gray-500 font-normal">التوقيع: __________________</div>
          </div>
          <div>
            التاريخ: _____ / _____ / 2026 م
            <div className="mt-2 text-gray-500 font-normal">الختم / الملاحظات: ________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
