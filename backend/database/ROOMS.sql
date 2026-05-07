CREATE TABLE Room (
  id TEXT PRIMARY KEY,
  name TEXT,
  room_code TEXT,
  bldg_id TEXT,
  floor TEXT,
  floor_type TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  active_flag INTEGER DEFAULT 1,
  FOREIGN KEY (bldg_id) REFERENCES Buildings(id)
);

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM201', 'College of Art and Sciences', 'CAS201', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM202', 'College of Art and Sciences', 'CAS202', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM203', 'College of Art and Sciences', 'CAS203', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM204', 'College of Art and Sciences', 'CAS204', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM205', 'College of Art and Sciences', 'CAS205', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM206', 'College of Art and Sciences', 'CAS206', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM207', 'College of Art and Sciences', 'CAS207', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM208', 'College of Art and Sciences', 'CAS208', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM209', 'College of Art and Sciences', 'CAS209', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM210', 'College of Art and Sciences', 'CAS210', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM211', 'College of Art and Sciences', 'CAS211', 'BLDGNX001', '2NDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM301', 'College of Art and Sciences', 'CAS301', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM302', 'College of Art and Sciences', 'CAS302', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM303', 'College of Art and Sciences', 'CAS303', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM304', 'College of Art and Sciences', 'CAS304', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM305', 'College of Art and Sciences', 'CAS305', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM306', 'College of Art and Sciences', 'CAS306', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM307', 'College of Art and Sciences', 'CAS307', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM308', 'College of Art and Sciences', 'CAS308', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM309', 'College of Art and Sciences', 'CAS309', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM310', 'College of Art and Sciences', 'CAS310', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('CL1', 'College of Art and Sciences', 'CAS CL-1', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('CL2', 'College of Art and Sciences', 'CAS CL-2', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('CL3', 'College of Art and Sciences', 'CAS CL-3', 'BLDGNX001', '3RDF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM401', 'College of Art and Sciences', 'CAS401', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM402', 'College of Art and Sciences', 'CAS402', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM403', 'College of Art and Sciences', 'CAS403', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM404', 'College of Art and Sciences', 'CAS404', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM405', 'College of Art and Sciences', 'CAS405', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM406', 'College of Art and Sciences', 'CAS406', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM407', 'College of Art and Sciences', 'CAS407', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM408', 'College of Art and Sciences', 'CAS408', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM409', 'College of Art and Sciences', 'CAS409', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM410', 'College of Art and Sciences', 'CAS410', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM411', 'College of Art and Sciences', 'CAS411', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM501', 'College of Art and Sciences', 'CAS501', 'BLDGNX001', '5THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM502', 'College of Art and Sciences', 'CAS502', 'BLDGNX001', '5THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM503', 'College of Art and Sciences', 'CAS503', 'BLDGNX001', '4THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM504', 'College of Art and Sciences', 'CAS504', 'BLDGNX001', '5THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM505', 'College of Art and Sciences', 'CAS505', 'BLDGNX001', '5THF', 'N/A', DATETIME('now'));

INSERT INTO Room (id, name, room_code, bldg_id, floor, floor_type, created_at)
VALUES ('RM506', 'College of Art and Sciences', 'CAS506', 'BLDGNX001', '5THF', 'N/A', DATETIME('now'));
