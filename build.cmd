@echo off

:: Check if .enc directory exists
if not exist .enc (
    echo .enc does not exist. Running createenv.cmd...
    call createenv.cmd
)

echo .enc exists. Activating the environment...
call .enc\Scripts\activate
echo Running PyInstaller...
pyinstaller --onefile .\clog_decomp.py
echo Done.

pause
