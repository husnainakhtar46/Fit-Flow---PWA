@echo off
echo Starting Django server on 0.0.0.0:8000...
echo Access from other devices using: http://192.168.2.108:8000
python manage.py runserver 0.0.0.0:8000
pause
