module("luci.controller.akile_ddns", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/akile-ddns") then
		return
	end

	local page = entry({"admin", "services", "akile-ddns"}, cbi("akile_ddns"), _("Akile DDNS"), 60)
	page.dependent = true
	page.acl_depends = { "luci-app-akile-ddns" }

	entry({"admin", "services", "akile-ddns", "status"}, call("act_status")).leaf = true
end

function act_status()
	local nixio = require "nixio"
	local fs = require "nixio.fs"
	local status_raw = fs.readfile("/var/run/akile-ddns.status") or ""
	local log_raw = fs.readfile("/var/log/akile-ddns.log") or ""

	local res = {
		running = false,
		last_check = "从未",
		current_ip = "未获取",
		status_msg = "未运行",
		log = log_raw
	}

	for line in status_raw:gmatch("[^\r\n]+") do
		local k, v = line:match('^([A-Z_]+)="?(.-)"?$')
		if k and v then
			if k == "RUNNING" then res.running = (v == "1")
			elseif k == "LAST_CHECK" then res.last_check = v
			elseif k == "CURRENT_IP" then res.current_ip = v
			elseif k == "STATUS_MSG" then res.status_msg = v
			end
		end
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(res)
end
