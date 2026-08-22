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
import { db } from '@/lib/firebase';
import { useUsers } from '@/context/users-context';
import { useToast } from '@/hooks/use-toast';

export interface HousingEmployee {
  id: string; // Firestore document ID
  employeeId: string; // Internal ID or Badge ID
  name: string;
  nameAr: string;
  profession: string;
  professionAr: string;
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
      const employeesRef = collection(db as any, 'housingEmployees');
      const q = query(employeesRef, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      const emps: HousingEmployee[] = [];
      snapshot.forEach((doc) => {
        emps.push({ id: doc.id, ...doc.data() } as HousingEmployee);
      });

      cachedHousingEmployees = emps;
      lastEmployeesFetchTime = Date.now();
      setEmployees(emps);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching housing employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees data.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return; // Wait for authentication
    fetchEmployees();
  }, [currentUser]);

  const addEmployee = async (data: Omit<HousingEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const employeesRef = collection(db, 'housingEmployees');
      const docRef = await addDoc(employeesRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const newEmp = { id: docRef.id, ...data, createdAt: new Date(), updatedAt: new Date() } as HousingEmployee;
      setEmployees(prev => {
        const next = [newEmp, ...prev];
        cachedHousingEmployees = next;
        return next;
      });
      toast({
        title: 'Success',
        description: 'Employee added successfully.',
      });
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to add employee.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateEmployee = async (id: string, data: Partial<HousingEmployee>) => {
    try {
      const empRef = doc(db, 'housingEmployees', id);
      await updateDoc(empRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      setEmployees(prev => {
        const next = prev.map(emp => emp.id === id ? { ...emp, ...data, updatedAt: new Date() } : emp);
        cachedHousingEmployees = next;
        return next;
      });
      toast({
        title: 'Success',
        description: 'Employee updated successfully.',
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee.',
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
