@echo off
setlocal enabledelayedexpansion

:: 1. 输入包名
set /p PACKAGE_NAME=请输入包名（例如 com.zhiliaoapp.musically）：

echo.
echo 正在获取 APK 路径...

:: 2. 获取 base.apk 路径（不需要 root）
for /f "delims=" %%i in ('adb shell pm path %PACKAGE_NAME% ^| findstr base.apk') do (
    set APK_FULL_PATH=%%i
)

if not defined APK_FULL_PATH (
    echo 未找到包，请确认包名是否正确！
    pause
    exit /b
)

:: 去掉 package:
set APK_FULL_PATH=!APK_FULL_PATH:package:=!

:: 去掉 /base.apk
set APK_DIR=!APK_FULL_PATH:/base.apk=!

echo APK_DIR = !APK_DIR!

:: 3. 路径拼接
set LIB_DIR=!APK_DIR!/lib/arm64
set OAT_DIR=!APK_DIR!/oat/arm64
set CYRUS_DIR=/data/data/%PACKAGE_NAME%/cyrus

echo.
echo ==============================
echo LIB_DIR  = !LIB_DIR!
echo OAT_DIR  = !OAT_DIR!
echo CYRUS_DIR= !CYRUS_DIR!
echo ==============================
echo.

:: 4. 检查 su 是否可用
echo 检查 root 权限...
adb shell su -c "id" >nul 2>&1
if errorlevel 1 (
    echo 无法获取 su 权限！
    echo 请确认设备已 root 且授权 adb shell
    pause
    exit /b
)
echo 已获取 root 权限
echo.

:: 步骤 1
echo 【1】禁止加载 cdex，清空 OAT 文件...
adb shell su -c "rm -rf \"%OAT_DIR%\"/*"
echo 已清空 %OAT_DIR%
echo.

:: 步骤 2
echo 【2】解决 Frida 反调试，删除 libmsaoaidsec.so ...
adb shell su -c "rm -f \"%LIB_DIR%/libmsaoaidsec.so\""
echo 已删除 libmsaoaidsec.so
echo.

:: 步骤 3
set /p INPUT=【3】是否清空 cyrus 配置目录？[%CYRUS_DIR%] [y/N]：

if /i "%INPUT%"=="y" (
    echo 正在清空 cyrus...
    adb shell su -c "rm -rf \"%CYRUS_DIR%\"/*"
    echo 已清空 %CYRUS_DIR%
) else (
    echo 跳过清空 cyrus 配置目录
)

echo.
echo 所有操作已完成。
pause
