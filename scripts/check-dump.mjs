import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data_exports/firestore-dump-complete.json', 'utf8'));
const att = (data.attendanceRecords || []).filter(r => String(r.employeeId) === '41099' || String(r.badgeId) === '41099');
console.log('Found attendance records for 41099:', att.length);
att.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
console.log(JSON.stringify(att.map(a => ({
  date: a.date,
  checkIn: a.checkIn,
  checkOut: a.checkOut,
  regularHours: a.regularHours,
  totalHours: a.totalHours,
  status: a.status,
  punches: a.punches
})), null, 2));
