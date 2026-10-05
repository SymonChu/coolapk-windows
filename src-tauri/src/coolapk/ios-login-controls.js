// iOS 没有桌面窗口标题栏，在官方登录页提供返回入口。
(function () {
    if (window.top !== window || !/^https:$/.test(location.protocol)) return;
    if (!['account.coolapk.com', 'www.coolapk.com', 'm.coolapk.com', 'coolapk.com'].includes(location.hostname)) return;

    /**
     * 顶部安全区高度。
     * 酷安官网自带的 viewport meta 没有 viewport-fit=cover，这种页面里
     * env(safe-area-inset-top) 恒为 0，只按它定位会把按钮塞进状态栏/灵动岛下面
     * （真机上只露出一半），因此取不到真实值时要按屏幕尺寸兜底。
     */
    function safeAreaTop() {
        var probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;display:block;pointer-events:none;height:env(safe-area-inset-top,0px);';
        document.documentElement.appendChild(probe);
        var measured = probe.getBoundingClientRect().height || 0;
        if (probe.parentNode) probe.parentNode.removeChild(probe);
        if (measured > 0) return measured;

        var screenSize = window.screen || {};
        var shortSide = Math.min(screenSize.width || 0, screenSize.height || 0);
        var longSide = Math.max(screenSize.width || 0, screenSize.height || 0);
        // 刘海/灵动岛 iPhone：短边 <= 480 且长边 >= 812（iPhone 8 Plus 只有 736）。
        if (shortSide <= 480 && longSide >= 812) return 48;
        // 非全面屏手机只是状态栏，桌面窗口给一点余量即可。
        return shortSide > 0 && shortSide <= 480 ? 28 : 12;
    }

    function mountReturnButton() {
        if (!document.documentElement || document.getElementById('coolapk-ios-login-return')) return;
        var host = document.createElement('div');
        host.id = 'coolapk-ios-login-return';
        host.style.cssText = 'all:initial!important;position:fixed!important;top:' + (safeAreaTop() + 8) + 'px!important;right:calc(env(safe-area-inset-right, 0px) + 8px)!important;z-index:2147483647!important;';
        // 隔离官网样式，保证按钮尺寸和点击范围，不覆盖整张登录表单。
        var root = host.attachShadow({ mode: 'closed' });
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = '返回应用';
        button.setAttribute('aria-label', '同步登录凭据并返回应用');
        button.style.cssText = 'border:1px solid #ccc;border-radius:10px;background:#fff;color:#222;padding:12px 16px;min-height:44px;font:15px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.16);';
        button.addEventListener('click', function () {
            button.disabled = true;
            button.textContent = '正在返回…';
            // 不开放远程 IPC；原生导航回调拦截标记，先校验 Cookie 再关闭窗口。
            location.href = 'coolapk-login://return';
            setTimeout(function () { button.disabled = false; button.textContent = '返回应用'; }, 8000);
        });
        root.appendChild(button);
        document.documentElement.appendChild(host);
    }

    mountReturnButton();
    document.addEventListener('DOMContentLoaded', mountReturnButton);
    new MutationObserver(mountReturnButton).observe(document, { childList: true, subtree: true });
})();
