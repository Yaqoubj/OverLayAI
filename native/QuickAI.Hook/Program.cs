using System.Diagnostics;
using System.Runtime.InteropServices;

internal static class Program
{
    private static IntPtr _hookId = IntPtr.Zero;
    private static LowLevelKeyboardProc? _proc;
    private static HotkeySpec _hotkey = new(Ctrl: true, Shift: false, Alt: false, Win: false, MainKey: 0x20);
    private static readonly HashSet<int> DownKeys = [];

    [STAThread]
    private static int Main(string[] args)
    {
        var parsed = TryParseArgs(args);
        if (parsed is not null)
        {
            _hotkey = parsed.Value;
        }

        _proc = HookCallback;
        _hookId = SetHook(_proc);
        if (_hookId == IntPtr.Zero)
        {
            Console.Error.WriteLine("Failed to install keyboard hook.");
            return 1;
        }

        Application.Run();
        return 0;
    }

    private static HotkeySpec? TryParseArgs(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (!string.Equals(args[i], "--hotkey", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return HotkeySpec.Parse(args[i + 1]);
        }

        return null;
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule;
        return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule?.ModuleName), 0);
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var vkCode = Marshal.ReadInt32(lParam);
            var message = (KeyboardMessage)wParam;
            var isDown = message is KeyboardMessage.KeyDown or KeyboardMessage.SysKeyDown;
            var isUp = message is KeyboardMessage.KeyUp or KeyboardMessage.SysKeyUp;

            if (isDown)
            {
                DownKeys.Add(vkCode);
                if (_hotkey.IsMatch(DownKeys))
                {
                    Console.WriteLine("TRIGGERED");
                    UnhookWindowsHookEx(_hookId);
                    _hookId = IntPtr.Zero;
                    Application.ExitThread();
                    return (IntPtr)1;
                }
            }
            else if (isUp)
            {
                DownKeys.Remove(vkCode);
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private const int WH_KEYBOARD_LL = 13;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);

    private enum KeyboardMessage
    {
        KeyDown = 0x0100,
        KeyUp = 0x0101,
        SysKeyDown = 0x0104,
        SysKeyUp = 0x0105
    }

    private readonly record struct HotkeySpec(bool Ctrl, bool Shift, bool Alt, bool Win, int MainKey)
    {
        public static readonly HashSet<int> ControlKeys = [0x11, 0xA2, 0xA3];
        public static readonly HashSet<int> ShiftKeys = [0x10, 0xA0, 0xA1];
        public static readonly HashSet<int> AltKeys = [0x12, 0xA4, 0xA5];
        public static readonly HashSet<int> WinKeys = [0x5B, 0x5C];

        public bool IsMatch(HashSet<int> downKeys)
        {
            if (Ctrl && !ControlKeys.Any(downKeys.Contains))
            {
                return false;
            }

            if (Shift && !ShiftKeys.Any(downKeys.Contains))
            {
                return false;
            }

            if (Alt && !AltKeys.Any(downKeys.Contains))
            {
                return false;
            }

            if (Win && !WinKeys.Any(downKeys.Contains))
            {
                return false;
            }

            return downKeys.Contains(MainKey);
        }

        public static HotkeySpec Parse(string accelerator)
        {
            var ctrl = false;
            var shift = false;
            var alt = false;
            var win = false;
            var mainKey = 0x20;

            foreach (var token in accelerator.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                switch (token.ToLowerInvariant())
                {
                    case "commandorcontrol":
                    case "control":
                    case "ctrl":
                        ctrl = true;
                        break;
                    case "shift":
                        shift = true;
                        break;
                    case "alt":
                    case "option":
                        alt = true;
                        break;
                    case "super":
                    case "meta":
                    case "win":
                        win = true;
                        break;
                    case "space":
                        mainKey = 0x20;
                        break;
                    default:
                        if (token.Length == 1)
                        {
                            mainKey = char.ToUpperInvariant(token[0]);
                        }
                        else if (token.StartsWith('F') && int.TryParse(token[1..], out var fn) && fn is >= 1 and <= 24)
                        {
                            mainKey = 0x6F + fn;
                        }
                        break;
                }
            }

            if (!ctrl && !shift && !alt && !win)
            {
                ctrl = true;
            }

            return new HotkeySpec(ctrl, shift, alt, win, mainKey);
        }
    }
}
