@echo off
:: If the folder doesn't exist then run the python -m venv .enc command
:: If the folder does exist then do nothing
if not exist .enc (
    python -m venv .enc
    call .enc\Scripts\activate.bat
    pip install -r requirements.txt
    Echo .enc folder created and requirements installed
) else (
    echo .enc folder already exists
)