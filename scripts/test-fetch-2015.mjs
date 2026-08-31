async function fetchReport(startDate, endDate) {
  const url = `http://213.210.196.115:8082/SacoOnline/HousCamps/ReportViewForInOutHistory.aspx?HousingRefs=&SponsRef=&DepRef=&DatInRef=${startDate}&DatOutRef=${endDate}&InputRerenc=EmpInOutHistory&UsrInput=HousAdmin`;
  console.log('Fetching:', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows = [];
  for (const tr of trMatches) {
    if (tr.includes('<th')) continue;
    const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (!tdMatches || tdMatches.length < 13) continue;
    const values = tdMatches.map((td) =>
      td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    );
    rows.push({
      sNo: values[0] || '',
      employeeId: values[1] || '',
      employeeName: values[2] || '',
      houseName: values[3] || '',
      department: values[4] || '',
      nationality: values[5] || '',
      profession: values[6] || '',
      building: values[7] || '',
      room: values[8] || '',
      sponsor: values[9] || '',
      remarks: values[10] || '',
      site: values[11] || '',
      dateIn: values[12] || '',
      dateOut: values[13] || '',
      days: values[14] || '',
    });
  }
  return rows;
}

async function run() {
  try {
    const rows = await fetchReport('2015-01-01', '2015-02-01');
    console.log('Total rows for Jan 2015:', rows.length);
    if (rows.length > 0) {
      console.log('Sample row 0:', rows[0]);
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

run();
