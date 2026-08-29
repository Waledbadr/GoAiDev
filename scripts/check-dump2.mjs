import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data_exports/firestore-dump-complete.json', 'utf8'));
const att = data.attendanceRecords || [];
console.log('Total attendanceRecords:', att.length);
const sample = att.slice(0, 10);
console.log('Sample:', sample.map(s => ({ id: s.id, employeeId: s.employeeId, badgeId: s.badgeId, name: s.firstName, date: s.date })));
const uniqueEmpIds = Array.from(new Set(att.map(a => a.employeeId || a.badgeId))).filter(Boolean);
console.log('Unique emp IDs in dump:', uniqueEmpIds);
