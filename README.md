<div align="center">

# 酷安 Windows 单文件版

**非官方酷安 Windows 桌面客户端**　·　免安装 **单文件 exe**　·　无边框圆角窗口

![首页](docs/preview/home.png)

</div>

> [!IMPORTANT]
> 本项目是社区维护的**非官方**客户端，与酷安官方及深圳酷安网络科技有限公司无隶属、授权或合作关系。
> 酷安名称、Logo 及相关商标归其权利人所有。

## 下载

到 [Releases](https://github.com/SymonChu/coolapk-windows/releases/latest) 下载 `coolapk-windows.exe`：**免安装、免解压**，双击即运行。
依赖系统自带的 WebView2（Windows 10/11 一般已内置）。

## 界面

三栏布局：**左侧导航 ／ 中间信息流 ／ 右侧栏**。

- **左侧导航**：可**收起为图标栏**，导航项含首页、热榜、话题广场、数码、应用与游戏、二手、好物与清单、应用下载、手机协同，以及「我的社区」分组（我的 / 我的关注 / 我的收藏 / 通知 / 设置）
- **中间**：顶部是栏目标签行（推荐 / 话题 / 关注 / 头条 / 热榜 / 快讯 / 新机 …）与快捷入口行，下方是**两个瀑布流并排**，**各自独立滚动、互不干涉**
- **右侧栏**：欢迎卡、大家都在搜、**我关注的话题**、热门话题，可**整块隐藏**
- 顶部栏有两个开关分别控制左右两栏显隐，**开关底色即当前状态**；隐藏左侧后信息流自动变宽

| 隐藏左右栏（信息流自动变宽） | 中间信息流特写 |
|---|---|
| ![隐藏左右栏](docs/preview/home-sidebar-hidden.png) | ![信息流特写](docs/preview/feeds-two-streams.png) |

### 自有功能

| 功能 | 说明 |
|---|---|
| **快捷回复** | 每条动态下方一个输入框 + 「发送」按钮，**不用打开评论页**就能直接回复（旁边另有 `+1` 快捷按钮） |
| **我关注的话题** | 右侧栏集中展示已关注话题与未读角标，底部可进入管理 |
| **左右栏显隐** | 顶栏两个开关，隐藏后信息流自动变宽 |

`prototype/home.html` 是**可交互**的界面稿：下载后用浏览器打开，点顶栏那两个开关可以自己试显隐；也支持用 `?state=hide-left,hide-right` 预设状态。

## 当前状态

| 已经打通 | 还在做 |
|---|---|
| 工程底座（Tauri 2 + Vue 3 + Rust），只保留 Windows 目标 | **界面稿尚未接入工程**（当前运行的仍是上游界面） |
| 无边框窗口 + 圆角，单文件 exe 打包（不打安装器） | 自有界面与登录 / 接口层的对接 |
| GitHub Actions 自动构建并发布单文件 exe（打 `v*` tag 自动发 Release） | **快捷回复**、**我关注的话题** 接入实际接口 |
| 构建后**启动自检**：在构建机上真跑一次 exe，并倒出启动日志 | 圆角在 Windows 10 上的表现待实机验证 |

也就是说：上面「自有功能」目前在**界面稿里已经能看到**，但装出来的 exe 还是上游界面，这两项要等界面接入工程后才在客户端里生效。

## 来源与致谢

本项目基于 **[daimiaopeng/coolapk-desktop](https://github.com/daimiaopeng/coolapk-desktop)**（MIT 许可证）改造：

- 保留其 Rust 端的酷安 **Token V3 兼容签名**、**官方授权登录**、**API / 会话请求层**；
- 在此基础上改名、裁剪为 Windows 单文件版，并按自有设计重做界面。

原项目的版权与许可声明见 [`LICENSE`](LICENSE)、[`NOTICE.md`](NOTICE.md)。
第三方品牌、Logo、表情及服务端内容**不在** MIT 授权范围内。

## 构建

环境：Node.js ≥ 22、Rust stable、[Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)、WebView2 Runtime。

```bash
npm install
npm run tauri build -- --no-bundle    # 只出单文件 exe，不打包安装器
```

产物：`src-tauri/target/release/coolapk-windows.exe`（免安装，双击运行）。

推送 `v*` 形式的 tag 时，GitHub Actions 会自动构建并把单文件 exe 挂到 Release 上。

## 目录结构

```
src/                     Vue 3 / TypeScript 前端
src-tauri/src/coolapk/   Rust：签名 auth.rs ／ 接口 client.rs ／ 命令 commands.rs
prototype/               界面稿（home.html 可交互 + 渲染图）
docs/preview/            README 使用的渲染截图
.github/workflows/       仅 Windows 的构建与发布流程
```

## 排障

**双击 exe 没反应？** 看 exe 同目录（该目录不可写时退到系统临时目录）的
`coolapk-windows-启动日志.txt`，里面逐行记录了启动到哪一步，能直接看出卡在哪。

**登录态 / 设置存在哪？** `%APPDATA%\com.coolapk.windows` —— 删掉这个目录相当于把客户端恢复出厂设置。

**换了版本要重新登录？** 应用数据目录跟随应用标识走。标识一旦变更，就是一份全新的数据目录，旧的登录态不会自动继承。

## 许可证

代码采用 [MIT 许可证](LICENSE)；第三方品牌与内容归属见 [`NOTICE.md`](NOTICE.md)。
