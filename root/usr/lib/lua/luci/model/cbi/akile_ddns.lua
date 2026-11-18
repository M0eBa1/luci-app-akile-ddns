local fs = require "nixio.fs"
local sys = require "luci.sys"

local m, s, o

m = Map("akile-ddns", translate("Akile DDNS"),
	translate("自动检测本地公网 IPv4 变动。仅在 IP 发生变动时提交 PUT 请求更新白名单；保存配置后将立即执行一次检测同步。"))

function m.on_after_commit(self)
	sys.call("/etc/init.d/akile-ddns restart >/dev/null 2>&1")
end

-- Status Section
s = m:section(NamedSection, "main", "global", translate("运行状态"))
s.anonymous = true

local status_raw = fs.readfile("/var/run/akile-ddns.status") or ""
local is_running = false
local cur_ip = translate("未获取")
local last_check = translate("从未")
local status_msg = translate("未运行")

for line in status_raw:gmatch("[^\r\n]+") do
	local k, v = line:match('^([A-Z_]+)="?(.-)"?$')
	if k and v then
		if k == "RUNNING" and v == "1" then is_running = true
		elseif k == "CURRENT_IP" and #v > 0 then cur_ip = v
		elseif k == "LAST_CHECK" and #v > 0 then last_check = v
		elseif k == "STATUS_MSG" and #v > 0 then status_msg = v
		end
	end
end

local status_html
if is_running then
	status_html = '<span style="color:green;font-weight:bold;">' .. translate("运行中") .. '</span>'
else
	status_html = '<span style="color:gray;font-weight:bold;">' .. translate("未运行") .. '</span>'
end

o = s:option(DummyValue, "_status", translate("服务状态"))
o.rawhtml = true
o.value = status_html

o = s:option(DummyValue, "_version", translate("插件版本"))
o.rawhtml = true
o.value = '<span style="background:#17a2b8;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;">v1.0.4</span>'

o = s:option(DummyValue, "_cur_ip", translate("当前公网 IP"))
o.rawhtml = true
o.value = '<strong style="color:#0072c6;">' .. cur_ip .. '</strong>'

o = s:option(DummyValue, "_last_check", translate("上次检查时间"))
o.value = last_check

o = s:option(DummyValue, "_status_msg", translate("最新同步结果"))
o.value = status_msg

-- Main Config Section
s = m:section(NamedSection, "main", "global", translate("基本设置"))
s.anonymous = true
s.addremove = false

o = s:option(Flag, "enabled", translate("启用服务"))
o.default = 0
o.rmempty = false

o = s:option(Value, "api_key", translate("API Key"),
	translate("填入 Akile API 密钥 (X-API-Key)，形如 ak_xxxx..."))
o.password = true
o.rmempty = false

o = s:option(Value, "interval", translate("检测间隔 (分钟)"),
	translate("定时检测公网 IP 变动的频率，默认 10 分钟。每次检测若 IP 未变化则不产生任何 API 请求。"))
o.datatype = "uinteger"
o.default = "10"
o.rmempty = false

o = s:option(ListValue, "ip_source", translate("公网 IP 获取方式"),
	translate("选择获取本机公网 IPv4 的方式，推荐自动多源轮询以确保稳定性。"))
o:value("auto", translate("自动多源轮询 (推荐)"))
o:value("ipw", translate("4.ipw.cn (国内高速)"))
o:value("ipify", translate("api4.ipify.org (国际常用)"))
o:value("ipsb", translate("api.ip.sb (Cloudflare网络)"))
o:value("ifconfig", translate("ifconfig.me"))
o:value("custom", translate("自定义 URL"))
o.default = "auto"

o = s:option(Value, "custom_ip_url", translate("自定义 IP 接口"),
	translate("输入返回纯文本 IPv4 地址的 HTTP(S) 地址"))
o:depends("ip_source", "custom")
o.placeholder = "https://api4.ipify.org"

-- Server & Port List Section
s = m:section(NamedSection, "main", "global", translate("转发规则与端口列表"))
s.anonymous = true
s.addremove = false

o = s:option(DynamicList, "server_list", translate("规则列表 (IP:端口 或 端口)"),
	translate("支持填入 <b>节点IP:端口</b> (例如 <code>103.152.220.1:10000</code> 或 <code>hk.akile.ai:20000</code>) 或直接填入 <b>纯端口</b> (例如 <code>10000</code>)。<br/>" ..
	"保存后插件会立即提取端口并查询更新规则；后续仅在检测到公网 IP 变化时才会进行 PUT 更改。"))
o.placeholder = "103.152.220.1:10000 或 10000"
o.rmempty = false

-- Log Section
s = m:section(NamedSection, "main", "global", translate("运行日志"))
s.anonymous = true

local log_content = fs.readfile("/var/log/akile-ddns.log") or translate("暂无日志记录")
o = s:option(TextValue, "_log")
o.rows = 15
o.wrap = "off"
o.readonly = true
function o.cfgvalue()
	return fs.readfile("/var/log/akile-ddns.log") or translate("暂无日志记录")
end

return m
