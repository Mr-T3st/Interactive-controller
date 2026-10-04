/*
  Tiny Windows x64 launcher for the portable build.
  It opens index.html located beside Interactive-controller.exe using the
  user's default browser. The prebuilt PE is stored under src/launcher/ so
  normal npm builds do not require a C compiler.
*/
typedef unsigned long DWORD;
typedef void* HANDLE;
typedef void* HWND;
typedef void* HINSTANCE;

__declspec(dllimport) DWORD __stdcall GetModuleFileNameA(HANDLE, char*, DWORD);
__declspec(dllimport) HINSTANCE __stdcall ShellExecuteA(HWND, const char*, const char*, const char*, const char*, int);
__declspec(dllimport) void __stdcall ExitProcess(unsigned int);

static void replace_filename_with_index(char *path, unsigned long len, unsigned long cap) {
  unsigned long i = len;
  while (i > 0 && path[i - 1] != '\\' && path[i - 1] != '/') i--;
  path[i] = 0;
  {
    const char suffix[] = "index.html";
    unsigned long j = 0;
    while (suffix[j] && i + j + 1 < cap) {
      path[i + j] = suffix[j];
      j++;
    }
    path[i + j] = 0;
  }
}

void __stdcall mainCRTStartup(void) {
  char path[4096];
  DWORD n = GetModuleFileNameA((HANDLE)0, path, 4096);
  if (n == 0 || n >= 4096) ExitProcess(2);
  replace_filename_with_index(path, n, 4096);
  {
    HINSTANCE result = ShellExecuteA((HWND)0, "open", path, (const char*)0, (const char*)0, 1);
    unsigned long long code = (unsigned long long)result;
    ExitProcess(code > 32 ? 0 : 3);
  }
}
