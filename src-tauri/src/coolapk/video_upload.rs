use crate::coolapk::client::http_client_builder;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde_json::{Value, json};
use sha1::{Digest, Sha1};
use std::time::Duration;

fn field<'a>(value: &'a Value, name: &str) -> Result<&'a str, String> { value.get(name).and_then(Value::as_str).filter(|text| !text.is_empty()).ok_or_else(|| format!("视频上传响应缺少 {name}")) }
fn hmac_hex(key: &[u8], text: &str) -> Result<String, String> { let mut mac = Hmac::<Sha1>::new_from_slice(key).map_err(|error| error.to_string())?; mac.update(text.as_bytes()); Ok(hex::encode(mac.finalize().into_bytes())) }
async fn vod_request(client: &Client, action: &str, body: &Value) -> Result<Value, String> {
    let response = client.post(format!("https://vod2.qcloud.com/v3/index.php?Action={action}")).json(body).send().await.map_err(|_| "视频上传服务连接失败".to_string())?;
    if !response.status().is_success() { return Err(format!("视频上传服务异常（HTTP {}）", response.status())); }
    let value: Value = response.json().await.map_err(|_| "视频上传服务响应无效".to_string())?;
    if value.get("code").and_then(Value::as_i64) != Some(0) { return Err(value.get("message").and_then(Value::as_str).unwrap_or("视频上传服务拒绝请求").to_string()); }
    value.get("data").cloned().ok_or_else(|| "视频上传服务未返回数据".to_string())
}
async fn put_object(client: &Client, prepared: &Value, path: &str, bytes: &[u8], content_type: &str) -> Result<(), String> {
    let certificate = &prepared["tempCertificate"];
    let bucket = field(prepared, "storageBucket")?; let region = field(prepared, "storageRegionV5")?;
    let app_id = prepared.get("storageAppId").and_then(Value::as_u64).ok_or("视频上传响应缺少存储标识")?;
    if !bucket.chars().all(|value| value.is_ascii_alphanumeric() || value == '-') || !region.chars().all(|value| value.is_ascii_alphanumeric() || value == '-') { return Err("视频存储地址无效".to_string()); }
    let host = format!("{bucket}-{app_id}.cos.{region}.myqcloud.com");
    let mut url = reqwest::Url::parse(&format!("https://{host}/")).map_err(|error| error.to_string())?;
    url.set_path(path.trim_start_matches('/'));
    let now = chrono::Utc::now().timestamp();
    let expires = certificate.get("expiredTime").and_then(Value::as_i64).ok_or("视频上传凭证缺少有效期")?;
    if expires <= now { return Err("视频上传凭证已过期，请重试".to_string()); }
    let time = format!("{};{}", now - 60, expires.min(now + 1800));
    let sign_key = hmac_hex(field(certificate, "secretKey")?.as_bytes(), &time)?;
    let canonical = format!("put\n{}\n\nhost={host}\n", url.path());
    let sign = hmac_hex(sign_key.as_bytes(), &format!("sha1\n{time}\n{:x}\n", Sha1::digest(canonical.as_bytes())))?;
    let authorization = format!("q-sign-algorithm=sha1&q-ak={}&q-sign-time={time}&q-key-time={time}&q-header-list=host&q-url-param-list=&q-signature={sign}", field(certificate, "secretId")?);
    let response = client.put(url).header("Authorization", authorization).header("x-cos-security-token", field(certificate, "token")?).header("Content-Type", content_type).body(bytes.to_vec()).send().await.map_err(|_| "视频文件上传失败，请重试".to_string())?;
    if !response.status().is_success() { return Err(format!("视频文件上传失败（HTTP {}）", response.status())); }
    Ok(())
}
// 复用 APK 内腾讯 UGC 的申请、COS 上传与确认流程，不调用图片或实况上传接口。
pub async fn upload(signature: &str, video: &[u8], name: &str, cover: &[u8], duration: u64) -> Result<Value, String> {
    if video.len() < 12 || &video[4..8] != b"ftyp" || cover.len() < 3 || cover[..3] != [0xff, 0xd8, 0xff] || duration == 0 { return Err("视频或封面无效".to_string()); }
    if video.len() > 256 * 1024 * 1024 { return Err("请选择不超过 256 MB 的视频".to_string()); }
    let kind = if video.get(8..12) == Some(b"qt  ") { "mov" } else { "mp4" };
    let client = http_client_builder().timeout(Duration::from_secs(600)).build().map_err(|error| error.to_string())?;
    let report_id = format!("coolapk-desktop-{}", chrono::Utc::now().timestamp_millis());
    let prepared = vod_request(&client, "ApplyUploadUGC", &json!({ "signature": signature, "videoName": name, "videoType": kind, "videoSize": video.len(), "coverName": "cover.jpg", "coverType": "jpg", "coverSize": cover.len(), "clientReportId": report_id, "clientVersion": "9.1.10566" })).await?;
    put_object(&client, &prepared, field(&prepared["video"], "storagePath")?, video, if kind == "mov" { "video/quicktime" } else { "video/mp4" }).await?;
    put_object(&client, &prepared, field(&prepared["cover"], "storagePath")?, cover, "image/jpeg").await?;
    let committed = vod_request(&client, "CommitUploadUGC", &json!({ "signature": signature, "vodSessionKey": field(&prepared, "vodSessionKey")?, "clientReportId": report_id, "clientVersion": "9.1.10566" })).await?;
    let video_url = field(&committed["video"], "url")?; let cover_url = field(&committed["cover"], "url")?;
    let identify = format!("{:x}", md5::Md5::digest(format!("coolapkVideo:{video_url}").as_bytes()));
    let info = json!({ "name": "", "mediaType": "video", "artistName": "", "duration": duration, "cover": cover_url, "isLive": false, "identify": identify, "source": "11", "redirectSource": false, "requestParams": json!({ "普通": { "fromType": "coolapkVideo", "0": video_url, "1": duration } }).to_string() });
    Ok(json!({ "code": 200, "data": { "mediaUrl": video_url, "mediaInfo": info.to_string(), "cover": cover_url } }))
}
