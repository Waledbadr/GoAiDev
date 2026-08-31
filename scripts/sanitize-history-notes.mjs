import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('data', 'cpc-d1-database.json');

if (!fs.existsSync(DB_FILE)) {
  console.log('Database file not found:', DB_FILE);
  process.exit(1);
}

console.log('Reading database...');
const raw = fs.readFileSync(DB_FILE, 'utf8');
const data = JSON.parse(raw);

function cleanNote(str) {
  if (!str || typeof str !== 'string') return null;
  let text = str.trim();
  text = text.replace(/^(ملاحظات|سبب الخروج|سبب التسكين|السبب|Notes?|Reason|Legacy)\s*:\s*/i, '').trim();
  text = text.replace(/^["'«»“”\(]+|["'«»“”\)]+$/g, '').trim();
  
  if (
    !text ||
    /^سجل\s+تسكين\s+تاريخي(\s+\d+)?$/i.test(text) ||
    /^مزامنة\s+النظام\s+القديم(\s*\(?\d*\)?)?$/i.test(text) ||
    /^تسكين\s+فترة\s+/i.test(text) ||
    /^خروج\s+مسجل\s+في\s+/i.test(text) ||
    text === 'خروج من السكن' ||
    text === 'تسكين' ||
    text === 'system_sync' ||
    text === 'Synced from legacy system' ||
    text === 'Occupied'
  ) {
    return null;
  }
  return text;
}

let modifiedHistory = 0;
let modifiedOccupants = 0;

['accommodation_history', 'accommodationHistory'].forEach(colName => {
  if (Array.isArray(data[colName])) {
    data[colName].forEach(item => {
      const origNotes = item.notes;
      const origReason = item.reason;
      
      const cleanedNote = cleanNote(item.notes) || cleanNote(item.reason);
      item.notes = cleanedNote || null;
      item.reason = cleanedNote || null;
      
      if (origNotes !== item.notes || origReason !== item.reason) {
        modifiedHistory++;
      }
    });
  }
});

if (Array.isArray(data.occupants)) {
  data.occupants.forEach(item => {
    const origNotes = item.notes;
    const cleanedNote = cleanNote(item.notes);
    item.notes = cleanedNote || null;
    if (origNotes !== item.notes) {
      modifiedOccupants++;
    }
  });
}

console.log(`Cleaned ${modifiedHistory} history records and ${modifiedOccupants} occupant records.`);
fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully written cleaned database to', DB_FILE);
