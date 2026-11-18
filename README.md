# luci-app-akile-ddns

OpenWrt / LEDE / ImmortalWrt 路由器插件：**Akile DDNS 端口转发规则入口白名单自动同步工具**。

定时检测路由器本地公网 IPv4 变动（默认每 10 分钟一次），当公网 IP 发生变化时，自动通过 Akile 开放 API 更新指定转发规则的入口白名单，保证转发链路不断连。

---

## ✨ 主要功能与特色

- 🌐 **多源公网 IPv4 智能检测**：内置 `4.ipw.cn` (国内高速)、`api4.ipify.org`、`ip.sb`、`ifconfig.me` 等多源自动轮询机制，支持自定义接口，确保在任何网络环境下均能准确获取本地公网 IP。
- 📋 **规则列表智能解析**：支持在 Web 界面配置一组 `节点IP:端口`（如 `103.152.220.1:10000` 或 `hk.akile.ai:20000`）或纯端口（如 `10000`），插件自动提取 `listen_port` 批量同步对应规则。
- ⚡ **智能比对与防频控**：获取 Akile 当前规则白名单后先进行本地比对，若已是最新则自动跳过，不浪费请求额度，严格遵守 120 次/分钟限频要求。
- 🖥️ **双版本 LuCI 界面支持**：
  - **现代 OpenWrt (21.02 / 22.03 / 23.05 / 24.10+)**：原生 JavaScript Client-side 视图，流畅美观。
  - **经典 OpenWrt (18.06 / 19.07 / Lean LEDE)**：Lua CBI 视图，全面兼容老版本固件。
- 📊 **服务状态与日志审计**：提供独立运行状态指示、当前公网 IP 展示、上次检查时间、最新同步结果以及实时运行日志查看器。
- 🚀 **即开即用 GitHub Actions**：推送仓库即可全自动打包并生成 `.ipk` 安装包，无需配置繁重的 OpenWrt SDK。

---

## 🛠️ GitHub 自动编译与使用

本项目已配置完整的 GitHub Actions CI/CD 流水线，你只需执行以下 3 步：

### 第一步：推送到你的 GitHub 仓库

1. 在 GitHub 上新建一个仓库（例如命名为 `luci-app-akile-ddns`）。
2. 在本地项目根目录下执行：
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for luci-app-akile-ddns"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git
   git push -u origin main
   ```

### 第二步：下载编译好的 `.ipk`

1. 推送代码后，进入 GitHub 仓库页面，点击上方的 **Actions** 选项卡。
2. 你会看到名为 **Build and Release OpenWrt Package** 的工作流正在自动运行（通常耗时仅 10-15 秒）。
3. 运行完成后，点击进入该次构建记录，在页面底部的 **Artifacts** 区域即可直接下载 `luci-app-akile-ddns-ipk` 压缩包（内含 `luci-app-akile-ddns_1.0.0-1_all.ipk` 和校验码）。
4. **发布 Release（可选）**：若在本地打上 Git 标签并推送（例如 `git tag v1.0.0 && git push --tags`），GitHub Actions 会自动在 **Releases** 页面发布带安装包下载的版本。

---

## 💻 本地一键打包

如果你不想使用 GitHub 编译，也可以直接在自己的电脑上打包（跨平台支持 Windows / macOS / Linux）：

```bash
# 确保已安装 Python 3
python build_ipk.py
```

执行后会在当前目录立即生成 `luci-app-akile-ddns_1.0.0-1_all.ipk`。

---

## 📦 源码编译安装 (OpenWrt SDK / Buildroot)

若你想将此插件编译进你的自定义 OpenWrt 固件中：

```bash
cd openwrt/package
git clone https://github.com/<你的用户名>/luci-app-akile-ddns.git
make menuconfig
# 在 LuCI -> 3. Applications 中勾选 luci-app-akile-ddns
make package/luci-app-akile-ddns/compile V=s
```

---

## 🚀 安装到 OpenWrt 路由器

1. **上传安装包到路由器**：
   ```bash
   scp luci-app-akile-ddns_1.0.0-1_all.ipk root@192.168.1.1:/tmp/
   ```

2. **登录路由器执行安装**：
   ```bash
   ssh root@192.168.1.1
   opkg update
   opkg install curl ca-bundle
   opkg install /tmp/luci-app-akile-ddns_1.0.0-1_all.ipk
   ```

3. **进入 Web 界面配置**：
   - 刷新路由器后台管理页面，进入 **服务** -> **Akile DDNS**。
   - 勾选 **启用服务**。
   - 输入你的 Akile **API Key**（以 `ak_` 开头）。
   - 检测周期默认 `10` 分钟。
   - 在 **规则列表** 中逐项添加需要同步的节点服务器或端口（例如 `103.152.220.1:10000` 或直接填 `10000`）。
   - 点击 **保存并应用** 即可！

---

## 📁 项目目录结构

```
luci-app-akile-ddns/
├── .github/
│   └── workflows/
│       └── build.yml               # GitHub Actions 自动化编译流
├── root/                           # 目标系统安装文件
│   ├── etc/
│   │   ├── config/akile-ddns       # UCI 默认配置文件
│   │   └── init.d/akile-ddns       # Procd 系统服务守护进程
│   ├── usr/
│   │   ├── bin/akile-ddns          # 后端核心检测与 API 同步脚本
│   │   ├── share/
│   │   │   ├── luci/menu.d/...     # LuCI JS 菜单配置
│   │   │   └── rpcd/acl.d/...      # RPC 权限配置
│   │   └── lib/lua/luci/...        # LuCI Lua CBI 兼容视图与控制器
│   └── www/
│       └── luci-static/resources/view/akile-ddns/index.js # 现代 LuCI JS 前端视图
├── Makefile                        # OpenWrt 官方标准编译规则
├── build_ipk.py                    # 跨平台一键 IPK 打包脚本
├── .gitignore
└── README.md                       # 说明文档
```

---

## 📜 许可证

MIT License.
