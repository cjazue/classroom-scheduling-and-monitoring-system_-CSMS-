CREATE TABLE Campus (
  id TEXT PRIMARY KEY,
  name TEXT,
  campus_code TEXT,
  address TEXT,
  created_at DATETIME
);

INSERT INTO Campus VALUES ('CAM001A','ANNEX CAMPUS','001A2008', 'Barangay Malinta, near Children of Mary Immaculate College', DATETIME('now'));
INSERT INTO Campus VALUES ('CAM010M','MAYSAN CAMPUS','010M2018', 'Tongco Street, Barangay Maysan, Valenzuela City', DATETIME('now'));
INSERT INTO Campus VALUES ('CAM011C','CPAG CAMPUS','011C2024', 'Maysan Road, Valenzuela City', DATETIME('now'));
