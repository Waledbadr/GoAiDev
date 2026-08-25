-- Timesheet dedicated tables and views in Cloudflare D1
CREATE VIEW IF NOT EXISTS attendance_records AS 
SELECT id, json_extract(data, '$.employeeId') as employee_id, json_extract(data, '$.name') as name, json_extract(data, '$.date') as date, json_extract(data, '$.status') as status, json_extract(data, '$.totalHours') as total_hours, data, created_at, updated_at 
FROM firestore_documents WHERE collection_name = 'attendanceRecords';

CREATE VIEW IF NOT EXISTS housing_employees AS 
SELECT id, json_extract(data, '$.employeeId') as badge_id, json_extract(data, '$.name') as name_en, json_extract(data, '$.nameAr') as name_ar, json_extract(data, '$.professionAr') as profession_ar, json_extract(data, '$.status') as status, data, created_at, updated_at 
FROM firestore_documents WHERE collection_name = 'housingEmployees';

CREATE VIEW IF NOT EXISTS timesheet_leaves AS 
SELECT id, json_extract(data, '$.employeeId') as employee_id, json_extract(data, '$.nameAr') as name_ar, json_extract(data, '$.type') as leave_type, json_extract(data, '$.startDate') as start_date, json_extract(data, '$.endDate') as end_date, data, created_at, updated_at 
FROM firestore_documents WHERE collection_name = 'timesheetLeaves';

CREATE VIEW IF NOT EXISTS timesheet_transfers AS 
SELECT id, json_extract(data, '$.employeeId') as employee_id, json_extract(data, '$.type') as transfer_type, json_extract(data, '$.date') as transfer_date, json_extract(data, '$.location') as location, data, created_at, updated_at 
FROM firestore_documents WHERE collection_name = 'timesheetTransfers';

CREATE VIEW IF NOT EXISTS timesheet_exceptions AS 
SELECT id, json_extract(data, '$.employeeId') as employee_id, json_extract(data, '$.type') as exception_type, json_extract(data, '$.startDate') as start_date, json_extract(data, '$.endDate') as end_date, json_extract(data, '$.hours') as hours, data, created_at, updated_at 
FROM firestore_documents WHERE collection_name = 'timesheetExceptions';
