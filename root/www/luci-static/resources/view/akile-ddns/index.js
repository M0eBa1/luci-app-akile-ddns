'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';

return view.extend({
	load: function() {
		return Promise.all([
			fs.read('/var/run/akile-ddns.status').catch(function() { return null; }),
			fs.read('/var/log/akile-ddns.log').catch(function() { return ''; }),
			uci.load('akile-ddns')
		]);
	},

	render: function(data) {
		var statusText = data[0] || '';
		var logText = data[1] || '';

		var statusObj = {
			RUNNING: '0',
			LAST_CHECK: '从未',
			CURRENT_IP: '未获取',
			STATUS_MSG: '未运行'
		};

		if (statusText) {
			var lines = statusText.split('\n');
			for (var i = 0; i < lines.length; i++) {
				var match = lines[i].match(/^([A-Z_]+)="?(.*?)"?$/);
				if (match) {
					statusObj[match[1]] = match[2];
				}
			}
		}

		var isRunning = (statusObj.RUNNING === '1');
		var statusBadge = isRunning
			? E('span', { 'class': 'label success', 'style': 'background:#28a745;color:#fff;padding:3px 8px;border-radius:4px;' }, _('运行中'))
			: E('span', { 'class': 'label warning', 'style': 'background:#6c757d;color:#fff;padding:3px 8px;border-radius:4px;' }, _('未运行'));

		var manualCheckBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'style': 'margin-left: 10px;',
			'click': function(ev) {
				ev.preventDefault();
				ui.showIndicator('akile_checking', _('正在立即检测公网 IP 并同步白名单...'));
				return fs.exec('/usr/bin/akile-ddns', ['check']).then(function() {
					return new Promise(function(resolve) { setTimeout(resolve, 1500); });
				}).then(function() {
					ui.hideIndicator('akile_checking');
					window.location.reload();
				}).catch(function(err) {
					ui.hideIndicator('akile_checking');
					ui.addNotification(null, E('p', _('检测执行异常: ') + err), 'error');
				});
			}
		}, _('立即检测并同步'));

		var statusCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('运行状态')),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'style': 'width:33%' }, _('服务状态')),
					E('td', { 'class': 'td left' }, [ statusBadge, manualCheckBtn ])
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('插件版本')),
					E('td', { 'class': 'td left' }, E('span', { 'class': 'label', 'style': 'background:#17a2b8;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;' }, 'v1.0.4'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('当前公网 IP')),
					E('td', { 'class': 'td left' }, E('strong', { 'style': 'color:#0072c6;' }, statusObj.CURRENT_IP || _('未获取')))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('上次检查时间')),
					E('td', { 'class': 'td left' }, statusObj.LAST_CHECK || _('无'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('最新同步结果')),
					E('td', { 'class': 'td left' }, statusObj.STATUS_MSG || _('无'))
				])
			])
		]);

		var m, s, o;

		m = new form.Map('akile-ddns', _('Akile DDNS'),
			_('自动检测本地公网 IPv4 变动并同步至 Akile 规则白名单。'));

		s = m.section(form.NamedSection, 'main', 'global', _('配置参数'));

		s.tab('basic', _('基本设置'));
		s.tab('rules', _('转发规则'));
		s.tab('log', _('运行日志'));

		// --- Tab: 基本设置 ---
		o = s.taboption('basic', form.Flag, 'enabled', _('启用服务'),
			_('勾选并保存后，服务将自动在后台守护运行。'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'api_key', _('API Key'),
			_('填入 Akile API 密钥 (X-API-Key)，形如 ak_xxxx...。请妥善保管。'));
		o.password = true;
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'interval', _('检测间隔 (分钟)'),
			_('定时检测公网 IP 变动的频率，默认 10 分钟。每次检测若 IP 未变化则不产生任何 API 请求。'));
		o.default = '10';
		o.datatype = 'and(uinteger, min(1))';

		o = s.taboption('basic', form.ListValue, 'ip_source', _('公网 IP 获取方式'),
			_('选择获取本机公网 IPv4 的方式，推荐自动多源轮询以确保稳定性。'));
		o.value('auto', _('自动多源轮询 (推荐)'));
		o.value('ipw', _('4.ipw.cn (国内高速)'));
		o.value('ipify', _('api4.ipify.org (国际常用)'));
		o.value('ipsb', _('api.ip.sb (Cloudflare网络)'));
		o.value('ifconfig', _('ifconfig.me'));
		o.value('custom', _('自定义 URL'));
		o.default = 'auto';

		o = s.taboption('basic', form.Value, 'custom_ip_url', _('自定义 IP 接口'),
			_('输入返回纯文本 IPv4 地址的 HTTP(S) 地址'));
		o.depends('ip_source', 'custom');
		o.placeholder = 'https://api4.ipify.org';

		// --- Tab: 转发规则 ---
		o = s.taboption('rules', form.DynamicList, 'server_list', _('规则列表 (IP:端口 或 端口)'),
			_('支持填入 <b>节点IP:端口</b> (例如 <code>103.152.220.1:10000</code> 或 <code>hk.akile.ai:20000</code>) 或直接填入 <b>纯端口</b> (例如 <code>10000</code>)。<br/>' +
			  '保存后插件会立即提取端口并查询更新规则；后续仅在检测到公网 IP 变化时才会进行 PUT 更改。'));
		o.placeholder = '103.152.220.1:10000 或 10000';
		o.rmempty = false;

		// --- Tab: 运行日志 ---
		var logArea = E('textarea', {
			'id': 'akile_ddns_log',
			'class': 'cbi-input-textarea',
			'style': 'width: 100%; height: 260px; font-family: monospace; font-size: 12px; background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; resize: vertical;',
			'readonly': 'readonly'
		}, [ logText || _('暂无日志记录') ]);

		var refreshBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'style': 'margin-top: 8px;',
			'click': function(ev) {
				ev.preventDefault();
				fs.read('/var/log/akile-ddns.log').then(function(content) {
					logArea.value = content || _('暂无日志记录');
					logArea.scrollTop = logArea.scrollHeight;
				});
			}
		}, _('刷新日志'));

		o = s.taboption('log', form.DummyValue, '_log_view', _('实时日志'));
		o.render = function() {
			return E('div', {}, [ logArea, refreshBtn ]);
		};

		return m.render().then(function(mapNode) {
			return E('div', {}, [ statusCard, mapNode ]);
		});
	},

	handleSaveApply: function(ev, mode) {
		var self = this;
		return this.handleSave(ev).then(function() {
			ui.showIndicator('akile_saving', _('正在保存配置并重启服务...'));
			return fs.exec('/etc/init.d/akile-ddns', ['enable']).then(function() {
				return fs.exec('/etc/init.d/akile-ddns', ['restart']);
			}).then(function() {
				return new Promise(function(resolve) { setTimeout(resolve, 2500); });
			}).then(function() {
				ui.hideIndicator('akile_saving');
				window.location.reload();
			}).catch(function(err) {
				ui.hideIndicator('akile_saving');
				window.location.reload();
			});
		});
	}
});
