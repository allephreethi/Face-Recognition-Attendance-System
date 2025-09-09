USE AttendanceDB;
GO

USE AttendanceDB;
GO

CREATE TABLE Attendance (
    id INT IDENTITY PRIMARY KEY,
    student_name NVARCHAR(100) NOT NULL,
    [timestamp] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    photo VARBINARY(MAX) NULL
);
GO


SELECT*FROM attendance;
