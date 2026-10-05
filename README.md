# 酷安 Windows 单文件版（coolapk-windows）

非官方酷安 Windows 桌面客户端，**免安装单文件 exe**，无边框圆角窗口。

> ⚠️ 本项目是社区维护的非官方客户端，与酷安官方及深圳酷安网络科技有限公司无隶属、授权或合作关系。
> 酷安名称、Logo 和相关商标归其权利人所有。

## 现状（开发早期）

| 已完成 | 未完成 |
|---|---|
| 工程底座（Tauri 2 + Vue 3 + Rust），已改名并只保留 Windows 目标 | 界面稿尚未接入工程 |
| 无边框 + 透明 + CSS 圆角窗口配置 | 登录 / 接口层尚未接上 |
| 界面稿（首页三栏 + 中间两列各自独立滚动）见 [`prototype/`](prototype/) | Windows 单文件 exe 尚未出包 |
| 只出单文件 exe（关闭安装包打包） | |

界面稿预览：[`prototype/home.png`](prototype/home.png)（可交互网页版 `prototype/home.html`）

## 来源与致谢

本项目基于 **[daimiaopeng/coolapk-desktop](https://github.com/daimiaopeng/coolapk-desktop)**（MIT）改造：

- 保留了其 Rust 端的酷安 Token V3 兼容签名、官方授权登录、API/会话请求层；
- 在此基础上改名、裁剪为 Windows 单文件版，并按自有设计重做界面（见 `prototype/`）。

原项目的版权与许可声明见 [`LICENSE`](LICENSE)、[`NOTICE.md`](NOTICE.md)。
第三方品牌、Logo、表情及服务端内容不在 MIT 授权范围内。

## 技术栈

- **Tauri 2** + **Vue 3** + **TypeScript**（Vite / Pinia / vue-router）
- **Rust**：酷安签名（`src-tauri/src/coolapk/auth.rs`）、接口与图片请求（`client.rs`）、Tauri commands（`commands.rs`）

## 构建（Windows）

环境：Node.js ≥ 22、Rust stable、[Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)、WebView2 Runtime。

```bash
npm install
npm run tauri build -- --no-bundle    # 只出单文件 exe，不打包安装器
```

产物：`src-tauri/target/release/coolapk-windows.exe`（免安装，双击运行）。

## 许可证

代码采用 [MIT 许可证](LICENSE)；第三方品牌与内容归属见 [`NOTICE.md`](NOTICE.md)。
