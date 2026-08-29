import { execSync } from 'child_process';

try {
  const output = execSync('npx wrangler d1 execute estatecare --remote --command="SELECT data FROM firestore_documents WHERE collection_name = \'attendanceRecords\' AND json_extract(data, \'$.employeeId\') = \'41099\'" --json', { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  const records = parsed[0].results.map(r => JSON.parse(r.data));
  console.log('Total records for 41099:', records.length);
  records.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  records.forEach(r => {
    console.log(r.date, 'CheckIn:', r.checkIn, 'CheckOut:', r.checkOut, 'RH:', r.regularHours, 'TotalH:', r.totalHours, 'Status:', r.status, 'Punches:', r.punches);
  });
} catch (e) {
  console.error(e);
}
