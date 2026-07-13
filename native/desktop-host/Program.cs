using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;

internal static class Program
{
    private const int GwlStyle = -16;
    private const long WsCaption = 0x00C00000L;
    private const long WsThickFrame = 0x00040000L;
    private const uint SmtoNormal = 0x0000;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpFrameChanged = 0x0020;

    private delegate bool EnumWindowsProc(nint hwnd, nint lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern nint FindWindow(string? className, string? windowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern nint FindWindowEx(nint parent, nint childAfter, string? className, string? windowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc callback, nint lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern nint SendMessageTimeout(nint hwnd, uint message, nint wParam, nint lParam, uint flags, uint timeout, out nint result);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern nint SetParent(nint child, nint newParent);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern nint GetParent(nint hwnd);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern nint GetWindowLongPtr(nint hwnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern nint SetWindowLongPtr(nint hwnd, int index, nint value);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(nint hwnd, nint insertAfter, int x, int y, int cx, int cy, uint flags);

    private static int Main(string[] args)
    {
        if (args.Length < 2 || args.Length > 4 ||
            (args[0] != "inspect" && args[0] != "attach" && args[0] != "detach" && args[0] != "status") ||
            !TryPositive(args[1], out nint hwnd))
            return Fail("参数必须是 inspect/attach/detach/status 和正数字窗口句柄");

        try
        {
            return args[0] switch
            {
                "inspect" when args.Length == 2 => Inspect(hwnd),
                "attach" when args.Length == 2 => Attach(hwnd),
                "detach" when args.Length == 4 => Detach(hwnd, args[2], args[3]),
                "status" when args.Length == 2 => Status(hwnd),
                _ => Fail("命令参数数量无效")
            };
        }
        catch (Exception exception)
        {
            return Fail(exception.Message);
        }
    }

    private static int Inspect(nint hwnd)
    {
        nint originalParent = GetParentChecked(hwnd);
        nint originalStyle = GetStyleChecked(hwnd);
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            success = true,
            parent = originalParent.ToInt64().ToString(),
            originalParent = originalParent.ToInt64().ToString(),
            originalStyle = originalStyle.ToInt64().ToString(),
            message = "已读取窗口恢复信息"
        }));
        return 0;
    }

    private static int Attach(nint hwnd)
    {
        nint progman = FindWindow("Progman", null);
        if (progman == 0) return Fail("找不到 Progman");
        SendMessageTimeout(progman, 0x052C, 0, 0, SmtoNormal, 1000, out _);

        nint worker = 0;
        EnumWindows((top, _) =>
        {
            if (FindWindowEx(top, 0, "SHELLDLL_DefView", null) == 0) return true;
            worker = FindWindowEx(0, top, "WorkerW", null);
            return worker == 0;
        }, 0);
        if (worker == 0) return Fail("找不到 WorkerW 桌面层");

        nint originalStyle = GetStyleChecked(hwnd);
        nint desktopStyle = new(originalStyle.ToInt64() & ~WsCaption & ~WsThickFrame);
        SetStyleChecked(hwnd, desktopStyle);
        SetWindowPosChecked(hwnd);
        SetParentChecked(hwnd, worker);
        if (GetParentChecked(hwnd) != worker || GetStyleChecked(hwnd) != desktopStyle)
            throw new InvalidOperationException("未能验证 WorkerW 嵌入结果");

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            success = true,
            parent = worker.ToInt64().ToString(),
            message = "已嵌入桌面"
        }));
        return 0;
    }

    private static int Detach(nint hwnd, string parentText, string styleText)
    {
        if (!TryNonNegative(parentText, out nint originalParent)) return Fail("原始父窗口句柄无效");
        if (!long.TryParse(styleText, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long style) ||
            style.ToString(CultureInfo.InvariantCulture) != styleText)
            return Fail("原始窗口样式无效");
        nint originalStyle = new(style);

        SetParentChecked(hwnd, originalParent);
        SetStyleChecked(hwnd, originalStyle);
        SetWindowPosChecked(hwnd);
        if (GetParentChecked(hwnd) != originalParent)
            throw new InvalidOperationException("最终父窗口验证失败");
        if (GetStyleChecked(hwnd) != originalStyle)
            throw new InvalidOperationException("最终窗口样式验证失败");

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            success = true,
            parent = originalParent.ToInt64().ToString(),
            style = originalStyle.ToInt64().ToString(),
            message = "已恢复窗口"
        }));
        return 0;
    }

    private static int Status(nint hwnd)
    {
        nint parent = GetParentChecked(hwnd);
        nint style = GetStyleChecked(hwnd);
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            success = true,
            parent = parent.ToInt64().ToString(),
            style = style.ToInt64().ToString(),
            message = "状态查询成功"
        }));
        return 0;
    }

    private static nint GetParentChecked(nint hwnd)
    {
        Marshal.SetLastPInvokeError(0);
        nint parent = GetParent(hwnd);
        int error = Marshal.GetLastPInvokeError();
        if (parent == 0 && error != 0) ThrowWin32("GetParent", error);
        return parent;
    }

    private static nint GetStyleChecked(nint hwnd)
    {
        Marshal.SetLastPInvokeError(0);
        nint style = GetWindowLongPtr(hwnd, GwlStyle);
        int error = Marshal.GetLastPInvokeError();
        if (style == 0 && error != 0) ThrowWin32("GetWindowLongPtr", error);
        return style;
    }

    private static void SetParentChecked(nint hwnd, nint parent)
    {
        Marshal.SetLastPInvokeError(0);
        nint previous = SetParent(hwnd, parent);
        int error = Marshal.GetLastPInvokeError();
        if (previous == 0 && error != 0) ThrowWin32("SetParent", error);
        if (GetParentChecked(hwnd) != parent) throw new InvalidOperationException("SetParent 最终值不匹配");
    }

    private static void SetStyleChecked(nint hwnd, nint style)
    {
        Marshal.SetLastPInvokeError(0);
        nint previous = SetWindowLongPtr(hwnd, GwlStyle, style);
        int error = Marshal.GetLastPInvokeError();
        if (previous == 0 && error != 0) ThrowWin32("SetWindowLongPtr", error);
        if (GetStyleChecked(hwnd) != style) throw new InvalidOperationException("SetWindowLongPtr 最终值不匹配");
    }

    private static void SetWindowPosChecked(nint hwnd)
    {
        Marshal.SetLastPInvokeError(0);
        if (!SetWindowPos(hwnd, 0, 0, 0, 0, 0, SwpNoMove | SwpNoSize | SwpNoZOrder | SwpFrameChanged))
            ThrowWin32("SetWindowPos", Marshal.GetLastPInvokeError());
    }

    private static void ThrowWin32(string operation, int error) =>
        throw new Win32Exception(error, $"{operation} 失败");

    private static bool TryPositive(string value, out nint handle)
    {
        handle = 0;
        return long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out long parsed) &&
            parsed > 0 && (handle = new nint(parsed)) != 0;
    }

    private static bool TryNonNegative(string value, out nint handle)
    {
        handle = 0;
        return long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out long parsed) &&
            parsed >= 0 && (parsed == 0 || (handle = new nint(parsed)) != 0);
    }

    private static int Fail(string message)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { success = false, message }));
        return 1;
    }
}
