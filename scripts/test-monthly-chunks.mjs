async function fetchMonth(startStr, endStr) {
  const url = `http://213.210.196.115:8082/SacoOnline/HousCamps/ReportViewForInOutHistory.aspx?HousingRefs=&SponsRef=&DepRef=&DatInRef=${startStr}&DatOutRef=${endStr}&InputRerenc=EmpInOutHistory&UsrInput=HousAdmin`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function run() {
  console.log('Testing 3 months of 2015:');
  const periods = [
    { name: 'Jan 2015', start: '2014-12-21', end: '2015-01-20' },
    { name: 'Feb 2015', start: '2015-01-21', end: '2015-02-20' },
    { name: 'Mar 2015', start: '2015-02-21', end: '2015-03-20' },
  ];

  for (const p of periods) {
    try {
      const rows = await fetchMonth(p.start, p.end);
      console.log(`${p.name} (${p.start} -> ${p.end}): Fetched ${rows.length} rows`);
      if (rows.length > 0) {
        console.log('  Houses:', [...new Set(rows.map(r => r.houseName))].join(', '));
      }
    } catch (err) {
      console.error(`${p.name} failed:`, err.message);
    }
  }
}

run();
