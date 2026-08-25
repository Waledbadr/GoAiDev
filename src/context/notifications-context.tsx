'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { d1Client } from '@/lib/d1-client';
import { collection, query, where, orderBy, doc, updateDoc, writeBatch, Timestamp, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData, Query } from 'firebase/firestore';
import safeOnSnapshot from '@/lib/firestore-utils';
import { useUsers } from './users-context';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'transfer_request' | 'order_approved' | 'new_order' | 'generic' | 'feedback_update';
  href: string;
  referenceId: string;
  isRead: boolean;
  createdAt: Timestamp;
  userEmail?: string;
}

export type NewNotificationPayload = Omit<Notification, 'id' | 'isRead' | 'createdAt'>;

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'new_order' | 'order_approved' | 'transfer_request' | 'generic' | 'mrv_request';
  href?: string;
  referenceId?: string;
  createdAt?: Timestamp;
}

interface NotificationsContextType {
  notifications: Notification[];
  loading: boolean;
  addNotification: (payload: NewNotificationPayload) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const firebaseErrorMessage = "Error: Firebase is not configured.";

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useUsers();
  const { toast } = useToast();

  useEffect(() => {
    async function loadNotificationsFromD1() {
      try {
        const d1Notifs = await d1Client.getDocs<any>('notifications');
        if (d1Notifs) {
          const userNotifs = currentUser?.id
            ? d1Notifs.filter((n: any) => n.userId === currentUser.id || n.userEmail === currentUser.email)
            : d1Notifs;
          setNotifications(userNotifs);
        }
      } catch (err) {
        console.warn('D1 notifications fetch notice:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotificationsFromD1();
  }, [currentUser]);

  const addNotification = async (payload: NewNotificationPayload) => {
    if (!db) {
      // Silent failure with optional toast for developers
      console.warn(firebaseErrorMessage);
      return;
    }
    try {
      // If payload already has userEmail, prefer it; otherwise attempt to look it up
      let userEmail: string | null = (payload as any).userEmail || null;
      if (!userEmail) {
        try {
          const userRef = doc(db!, 'users', payload.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const d = userSnap.data() as any;
            userEmail = (d.email && String(d.email)) || null;
          }
        } catch {}
      }
      await addDoc(collection(db!, 'notifications'), {
        ...payload,
        isRead: false,
        createdAt: serverTimestamp(),
        userEmail: userEmail || null,
      });
    } catch (error) {
      console.error('Error adding notification:', error);
      // Silent for end-users
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!db) return;
    try {
      const notifRef = doc(db!, 'notifications', notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!db) return;
    const unreadNotifications = notifications.filter((n) => !n.isRead);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(db!);
      unreadNotifications.forEach((n) => {
        const notifRef = doc(db!, 'notifications', n.id);
        batch.update(notifRef, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <NotificationsContext.Provider value={{ notifications, loading, addNotification, markAsRead, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
