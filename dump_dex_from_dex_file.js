function getProcessName() {
    var openPtr = Module.getExportByName('libc.so', 'open');
    var open = new NativeFunction(openPtr, 'int', ['pointer', 'int']);

    var readPtr = Module.getExportByName("libc.so", "read");
    var read = new NativeFunction(readPtr, "int", ["int", "pointer", "int"]);

    var closePtr = Module.getExportByName('libc.so', 'close');
    var close = new NativeFunction(closePtr, 'int', ['int']);

    var path = Memory.allocUtf8String("/proc/self/cmdline");
    var fd = open(path, 0);
    if (fd != -1) {
        var buffer = Memory.alloc(0x1000);

        var result = read(fd, buffer, 0x1000);
        close(fd);
        result = ptr(buffer).readCString();
        return result;
    }

    return "-1";
}


function mkdir(path) {
    var mkdirPtr = Module.getExportByName('libc.so', 'mkdir');
    var mkdir = new NativeFunction(mkdirPtr, 'int', ['pointer', 'int']);


    var opendirPtr = Module.getExportByName('libc.so', 'opendir');
    var opendir = new NativeFunction(opendirPtr, 'pointer', ['pointer']);

    var closedirPtr = Module.getExportByName('libc.so', 'closedir');
    var closedir = new NativeFunction(closedirPtr, 'int', ['pointer']);

    var cPath = Memory.allocUtf8String(path);
    var dir = opendir(cPath);
    if (dir != 0) {
        closedir(dir);
        return 0;
    }
    mkdir(cPath, 755);
    chmod(path);
}

function chmod(path) {
    var chmodPtr = Module.getExportByName('libc.so', 'chmod');
    var chmod = new NativeFunction(chmodPtr, 'int', ['pointer', 'int']);
    var cPath = Memory.allocUtf8String(path);
    chmod(cPath, 755);
}

function readStdString(str) {
    const isTiny = (str.readU8() & 1) === 0;
    if (isTiny) {
        return str.add(1).readUtf8String();
    }

    return str.add(2 * Process.pointerSize).readPointer().readUtf8String();
}

function findSymbolInLib(libname, keywordList) {
    const libBase = Module.findBaseAddress(libname);
    if (!libBase) {
        console.error("[-] Library not loaded:", libname);
        return null;
    }

    const matches = [];
    const symbols = Module.enumerateSymbolsSync(libname);
    for (const sym of symbols) {
        if (keywordList.every(k => sym.name.includes(k))) {
            matches.push(sym);
        }
    }

    if (matches.length === 0) {
        console.error("[-] No matching symbol found for keywords:", keywordList);
        return null;
    }

    const target = matches[0]; // 取第一个匹配的
    console.log("[+] Found symbol:", target.name, " @ ", target.address);
    return target.address;
}

function dumpDexToFile(filename, base, size) {
    // packageName
    var processName = getProcessName();

    if (processName != "-1") {
        // 判断是否以 .dex 结尾
        if (!filename.endsWith(".dex")) {
            filename += ".dex";
        }

        const dir = "/sdcard/Android/data/" + processName + "/dump_dex";
        const fullPath = dir + "/" + filename.replace(/\//g, "_").replace(/!/g, "_");

        // 创建目录
        mkdir(dir);

        // dump dex
        var fd = new File(fullPath, "wb");
        if (fd && fd != null) {
            var dex_buffer = ptr(base).readByteArray(size);
            fd.write(dex_buffer);
            fd.flush();
            fd.close();
            console.log("[+] Dex dumped to", fullPath);
        }
    }
}

function hookCompactDexFile() {
    const addr = findSymbolInLib("libdexfile.so", ["CompactDexFile", "C1"]);
    if (!addr) return;

    Interceptor.attach(addr, {
        onEnter(args) {
            const base = args[1];
            const size = args[2].toInt32();
            const data_base = args[3];
            const data_size = args[4].toInt32();
            const location_ptr = args[5];
            const location = readStdString(location_ptr);

            console.log("\n[*] CompactDexFile constructor called");
            console.log("    this       :", args[0]);
            console.log("    base       :", base);
            console.log("    size       :", size);
            console.log("    data_base  :", data_base);
            console.log("    data_size  :", data_size);
            console.log("    location   :", location);

            // 文件名
            const filename = location.split("/").pop();

            // 魔数
            var magic = ptr(base).readCString();
            console.log("    magic      :", magic)

            // dex 格式校验
            if (magic.indexOf("dex") !== -1) {
                dumpDexToFile(filename, base, size)
            }
        }
    });
}

function hookStandardDexFile() {
    const addr = findSymbolInLib("libdexfile.so", ["StandardDexFile", "C1"]);
    if (!addr) return;

    Interceptor.attach(addr, {
        onEnter(args) {
            const base = args[1];
            const size = args[2].toInt32();
            const data_base = args[3];
            const data_size = args[4].toInt32();
            const location_ptr = args[5];
            const location = readStdString(location_ptr);

            console.log("\n[*] StandardDexFile constructor called");
            console.log("    this       :", args[0]);
            console.log("    base       :", base);
            console.log("    size       :", size);
            console.log("    data_base  :", data_base);
            console.log("    data_size  :", data_size);
            console.log("    location   :", location);

            // 文件名
            const filename = location.split("/").pop();

            // 魔数
            var magic = ptr(base).readCString();
            console.log("    magic      :", magic)

            // dex 格式校验
            if (magic.indexOf("dex") !== -1) {
                dumpDexToFile(filename, base, size)
            }
        }
    });
}


setImmediate(function () {
    hookCompactDexFile()
    hookStandardDexFile()
});

// frida -H 127.0.0.1:1234 -l dump_dex_from_dex_file.js -f com.cyrus.example