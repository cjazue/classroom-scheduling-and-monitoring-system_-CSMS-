CREATE TABLE Schedules (
  id TEXT PRIMARY KEY,
  section TEXT,
  subject TEXT,
  subject_code TEXT,
  day TEXT,
  campus_id TEXT,
  bldg_id TEXT,
  room_id TEXT,
  start_time TEXT,
  end_time TEXT,
  FOREIGN KEY (campus_id) REFERENCES Campus(id),
  FOREIGN KEY (bldg_id) REFERENCES Buildings(id),
  FOREIGN KEY (room_id) REFERENCES Room(id)
);


INSERT INTO Schedules VALUES('SCH6GE3','BSIT 1-6','The Contemporary World','GE3','Monday','CPAG','CPAG','CPAG401','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH6FIL2','BSIT 1-6','Filipino sa Ibat Ibang Displina','FIL2','Tuesday','Annex','CAS','CAS208','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH6PATHFIT2','BSIT 1-6','PE 2','PATHFIT2','Tuesday','Annex','NB','GYM 8','6:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH6CC3','BSIT 1-6','Intermediate Programming','CC3','Wednesday','Annex','CAS','CAS208','7:00AM','12:00PM');
INSERT INTO Schedules VALUES('SCH6MST4','BSIT 1-6','Living in the IT Era','MST4','Wednesday','Annex','NB','NB402','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH6GE10','BSIT 1-6','Ethics with Peace Education','GE10','Thursday','Annex','CAS','CAS209','7:00AM','10:00AM');
INSERT INTO Schedules VALUES('SCH6GE7','BSIT 1-6','Science, Technology, and Society','GE7','Thursday','Annex','CAS','CAS408','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH6GE1','BSIT 1-6','Understanding The Self','GE1','Friday','Annex','CAS','CAS301','12:00PM','3:00PM');
INSERT INTO Schedules VALUES('SCH6NSTP2','BSIT 1-6','NSTP 2','NSTP2','Friday','Annex','CAS','CAS504','5:30PM','8:30PM');

INSERT INTO Schedules VALUES('SCH7NSTP2','BSIT 1-7','NSTP 2','NSTP2','Monday','Annex','CAS','CAS309','10:30AM','1:30PM');
INSERT INTO Schedules VALUES('SCH7MST4','BSIT 1-7','Living in the IT Era','MST4','Monday','Annex','CAS','CAS406','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH7GE10','BSIT 1-7','Ethics with Peace Education','GE10','Tuesday','Annex','CAS','CAS308','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH7GE7','BSIT 1-7','Science, Technology, and Society','GE7','Tuesday','Annex','CAS','CAS409','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH7GE3','BSIT 1-7','The Contemporary World','GE3','Wednesday','Annex','CAS','CAS410','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH7PATHFIT2','BSIT 1-7','PE 2','PATHFIT2','Wednesday','Annex','NB','GYM 5','6:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH7CC3','BSIT 1-7','Intermediate Programming','CC3','Thursday','Annex','CAS','CAS-CL3','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH7GE1','BSIT 1-7','Understanding the Self','GE1','Saturday','Main','CEIT','CEIT LH-B','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH7FIL2','BSIT 1-7','Filipino sa Ibat Ibang Displina','FIL2','Saturday','Main','CABA','CABA401','5:00PM','8:00PM');

INSERT INTO Schedules VALUES('SCH8FIL2','BSIT 1-8','Filipino sa Ibat Ibang Displina','FIL2','Monday','Annex','CAS','CAS-CL1','2:30PM','7:30PM');
INSERT INTO Schedules VALUES('SCH8GE10','BSIT 1-8','Ethics with Peace Education','GE10','Tuesday','Annex','CAS','CAS306','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH8GE7','BSIT 1-8','Science, Technology, and Society','GE7','Tuesday','Annex','CAS','CAS310','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH8CC3','BSIT 1-8','Intermediate Programming','CC3','Wednesday','Annex','CAS','CAS-CL1','2:30PM','7:30PM');
INSERT INTO Schedules VALUES('SCH8NSTP2','BSIT 1-8','NSTP 2','NSTP2','Thursday','Annex','CAS','CAS407','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH8GE1','BSIT 1-8','Understanding the Self','GE1','Friday','Annex','CAS','CAS301','8:00AM','11:00AM');
INSERT INTO Schedules VALUES('SCH8GE3','BSIT 1-8','The Contemporary World','GE3','Friday','CPAG','CPAG','CPAG201','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH8PATHFIT2','BSIT 1-8','PE 2','PATHFIT2','Saturday','Annex','NB','GYM 6','8:00AM','10:00AM');
INSERT INTO Schedules VALUES('SCH8MST4','BSIT 1-8','Living in the IT Era','MST4','Saturday','Annex','CAS','CAS403','2:00PM','5:00PM');

INSERT INTO Schedules VALUES('SCH9GE1','BSIT 1-9','Understanding the Self','GE1','Monday','Annex','CAS','CAS306','7:30AM','10:30AM');
INSERT INTO Schedules VALUES('SCH9GE7','BSIT 1-9','Science, Technology, and Society','GE7','Monday','Annex','CAS','CAS408','5:00PM','8:00PM');
INSERT INTO Schedules VALUES('SCH9GE3','BSIT 1-9','The Contemporary World','GE3','Tuesday','CPAG','CPAG','CPAG401','4:30PM','7:30PM');
INSERT INTO Schedules VALUES('SCH9NSTP2','BSIT 1-9','NSTP 2','NSTP2','Wednesday','Annex','CAS','CAS408','10:30AM','1:30PM');
INSERT INTO Schedules VALUES('SCH9PATHFIT2','BSIT 1-9','PE 2','PATHFIT2','Wednesday','Annex','NB','GYM 6','4:00PM','6:00PM');
INSERT INTO Schedules VALUES('SCH9CC3','BSIT 1-9','Intermediate Programming','CC3','Friday','Annex','CAS','CAS-CL1','7:00AM','12:00PM');
INSERT INTO Schedules VALUES('SCH9FIL2','BSIT 1-9','Filipino sa Ibat Ibang Displina','FIL2','Friday','Annex','CAS','CAS211','1:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH9MST4','BSIT 1-9','Living in the IT Era','MST4','Saturday','Main','CEIT','CEIT505','7:00AM','10:00AM');
INSERT INTO Schedules VALUES('SCH9GE10','BSIT 1-9','Ethics with Peace Education','GE10','Saturday','Annex','CAS','CAS406','2:00PM','5:00PM');

INSERT INTO Schedules VALUES('SCH10GE1','BSIT 1-10','Understanding the Self','GE1','Tuesday','Annex','CAS','CAS208','7:30AM','10:30AM');
INSERT INTO Schedules VALUES('SCH10GE3','BSIT 1-10','The Contemporary World','GE3','Tuesday','CPAG','CPAG','CPAG402','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH10GE10','BSIT 1-10','Ethics with Peace Education','GE10','Wednesday','Annex','CAS','CAS407','10:30AM','1:30PM');
INSERT INTO Schedules VALUES('SCH10FIL2','BSIT 1-10','Filipino sa Ibat Ibang Displina','FIL2','Wednesday','Annex','CAS','CAS407','2:00PM','5:00PM');
INSERT INTO Schedules VALUES('SCH10MST4','BSIT 1-10','Living in the IT Era','MST4','Wednesday','Main','CEIT','CEIT COMLAB','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH10PATHFIT2','BSIT 1-10','PE 2','PATHFIT2','Thursday','Annex','NB','GYM 2','10:00AM','12:00PM');
INSERT INTO Schedules VALUES('SCH10NSTP2','BSIT 1-10','NSTP 2','NSTP2','Thursday','Annex','CAS','CAS411','5:30PM','8:30PM');
INSERT INTO Schedules VALUES('SCH10CC3','BSIT 1-10','Intermediate Programming','CC3','Friday','Annex','CAS','CAS-CL1','1:00PM','6:00PM');
INSERT INTO Schedules VALUES('SCH10GE7','BSIT 1-10','Science, Technology, and Society','GE7','Saturday','Annex','CAS','CAS410','7:00AM','10:00AM');


