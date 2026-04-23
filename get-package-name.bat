@echo off
setlocal enabledelayedexpansion

echo 正在获取当前前台应用包名...

:: 获取 ResumedActivity 行
for /f "tokens=4 delims= " %%i in ('adb shell dumpsys activity activities ^| findstr "ResumedActivity"') do (
    set COMPONENT=%%i
    goto PARSE
)

:PARSE
:: 分割包名和 Activity（格式为：包名/Activity）
for /f "delims=/ tokens=1" %%j in ("%COMPONENT%") do (
    set PACKAGE=%%j
)

echo 当前前台应用包名为：
echo %PACKAGE%
pause
