'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { d1Client } from '@/lib/d1-client';
import { useUsers } from '@/context/users-context';
import { useToast } from '@/hooks/use-toast';

export interface HousingEmployee {
  id: string; // Document ID
  employeeId: string; // Internal ID or Badge ID
  badgeId?: string;
  name: string;
  nameAr: string;
  profession: string;
  professionAr: string;
  department?: string;
  projectName?: string;
  dailyHours: number;
  monthlySalary: number;
  status: 'Active' | 'On Leave' | 'Transferred' | 'Inactive';
  residenceStatus: 'Inside' | 'Outside';
  residenceLocation?: string;
  createdAt: any;
  updatedAt: any;
}

interface HousingEmployeesContextType {
  employees: HousingEmployee[];
  loading: boolean;
  addEmployee: (data: Omit<HousingEmployee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<HousingEmployee>) => Promise<void>;
  refreshEmployees: () => Promise<void>;
}

const HousingEmployeesContext = createContext<HousingEmployeesContextType | undefined>(undefined);

// Shared in-memory cache across provider remounts (navigation)
let cachedHousingEmployees: HousingEmployee[] | null = null;
let lastEmployeesFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function HousingEmployeesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<HousingEmployee[]>(() => cachedHousingEmployees || []);
  const [loading, setLoading] = useState(() => !cachedHousingEmployees);
  const { currentUser } = useUsers();
  const { toast } = useToast();

  const fetchEmployees = async (force = false) => {
    if (!force && cachedHousingEmployees && (Date.now() - lastEmployeesFetchTime < CACHE_TTL_MS)) {
      setEmployees(cachedHousingEmployees);
      setLoading(false);
      return;
    }

    try {
      const d1Emps = await d1Client.getDocs<HousingEmployee>('housingEmployees');
      const emps = d1Emps || [];

      cachedHousingEmployees = emps;
      lastEmployeesFetchTime = Date.now();
      setEmployees(emps);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching housing employees from D1:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const addEmployee = async (data: Omit<HousingEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newId = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEmp: HousingEmployee = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await d1Client.setDoc('housingEmployees', newId, newEmp);

      setEmployees(prev => {
        const next = [newEmp, ...prev];
        cachedHousingEmployees = next;
        return next;
      });
      toast({
        title: 'تم الحفظ',
        description: 'تمت إضافة الموظف بنجاح في قاعدة بيانات Cloudflare D1.',
      });
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر إضافة الموظف.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateEmployee = async (id: string, data: Partial<HousingEmployee>) => {
    try {
      await d1Client.updateDoc('housingEmployees', id, data);
      setEmployees(prev => {
        const next = prev.map(emp => emp.id === id ? { ...emp, ...data, updatedAt: new Date().toISOString() } : emp);
        cachedHousingEmployees = next;
        return next;
      });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث بيانات الموظف بنجاح.',
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر تحديث بيانات الموظف.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const refreshEmployees = async () => {
    await fetchEmployees(true);
  };

  return (
    <HousingEmployeesContext.Provider
      value={{
        employees,
        loading,
        addEmployee,
        updateEmployee,
        refreshEmployees,
      }}
    >
      {children}
    </HousingEmployeesContext.Provider>
  );
}

export function useHousingEmployees() {
  const context = useContext(HousingEmployeesContext);
  if (context === undefined) {
    throw new Error('useHousingEmployees must be used within a HousingEmployeesProvider');
  }
  return context;
}
