CREATE TABLE Buildings (
  id TEXT PRIMARY KEY,
  name TEXT,
  bldg_code TEXT,
  campus_id TEXT,
  description TEXT,
  created_at DATETIME,
  FOREIGN KEY (campus_id) REFERENCES Campus(id)
);


INSERT INTO Buildings VALUES('BLDGNX001', 'College of Arts and Science', 'CAS', 'CAM001A', 'N/A', DATETIME('now'));
INSERT INTO Buildings VALUES('BLDGNX010', 'New Building',  'NB', 'CAM001A', 'N/A', 
DATETIME('now'));

INSERT INTO Buildings VALUES('BLDGCPG001', 'College of Public Administration and Governance', 'CPAG', 'CAM010M', 'N/A', DATETIME('now'));

INSERT INTO Buildings VALUES('BLDGM001', 'Student Building', 'SB', 'CAM011C', 'N/A', DATETIME('now'));
INSERT INTO Buildings VALUES('BLDGM010', 'College of Accountancy and Business Administration', 'CABA', 'CAM011C', 'N/A', DATETIME('now'));
INSERT INTO Buildings VALUES('BLDGM011', 'College of Engineering and Information Technology', 'CEIT', 'CAM011C', 'N/A', DATETIME('now'));
INSERT INTO Buildings VALUES('BLDGNX100', 'College of Education', 'COED', 'CAM011C', 'N/A', DATETIME('now'));
