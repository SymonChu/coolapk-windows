use webview2_com::{GetCookiesCompletedHandler, Microsoft::Web::WebView2::Win32::ICoreWebView2_2};
use windows::core::{HSTRING, Interface, PWSTR};

/// Keep the original native cookie objects: cookie::Cookie::domain() strips the
/// leading dot and cannot faithfully replace inherited WebView2 domain cookies.
pub(crate) async fn write_equipment_cookies(
    window: &tauri::WebviewWindow,
    cookies: Vec<tauri::webview::Cookie<'static>>,
) -> Result<(), String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window
        .with_webview(move |view| unsafe {
            let start = (|| -> windows::core::Result<()> {
                let core = view
                    .controller()
                    .CoreWebView2()?
                    .cast::<ICoreWebView2_2>()?;
                let manager = core.CookieManager()?;
                let callback_manager = manager.clone();
                manager.GetCookies(
                    &HSTRING::from("https://m.coolapk.com/mp/do"),
                    &GetCookiesCompletedHandler::create(Box::new(move |status, existing| {
                        let result = (|| -> windows::core::Result<()> {
                            status?;
                            if let Some(existing) = existing {
                                let mut count = 0;
                                existing.Count(&mut count)?;
                                for index in 0..count {
                                    let old = existing.GetValueAtIndex(index)?;
                                    let mut name = PWSTR::null();
                                    old.Name(&mut name)?;
                                    let text = name.to_string();
                                    windows::Win32::System::Com::CoTaskMemFree(Some(name.0.cast()));
                                    let name = text?;
                                    if let Some(cookie) =
                                        cookies.iter().find(|cookie| cookie.name() == name)
                                    {
                                        old.SetValue(&HSTRING::from(cookie.value()))?;
                                        old.SetExpires(-1.0)?;
                                        callback_manager.AddOrUpdateCookie(&old)?;
                                    }
                                }
                            }
                            for cookie in cookies {
                                let native = callback_manager.CreateCookie(
                                    &HSTRING::from(cookie.name()),
                                    &HSTRING::from(cookie.value()),
                                    &HSTRING::from("m.coolapk.com"),
                                    &HSTRING::from("/"),
                                )?;
                                native.SetExpires(-1.0)?;
                                native.SetIsSecure(true)?;
                                native.SetIsHttpOnly(true)?;
                                callback_manager.AddOrUpdateCookie(&native)?;
                            }
                            Ok(())
                        })();
                        let _ = sender.send(
                            result.map_err(|_| "Windows 装备窗口原生登录态同步失败".to_string()),
                        );
                        Ok(())
                    })),
                )?;
                Ok(())
            })();
            if start.is_err() {
                log::warn!("equipment.native_cookie_write_start_failed");
            }
        })
        .map_err(|_| "无法访问 Windows 装备窗口".to_string())?;
    receiver
        .await
        .map_err(|_| "Windows 装备窗口登录态同步中断".to_string())?
}
