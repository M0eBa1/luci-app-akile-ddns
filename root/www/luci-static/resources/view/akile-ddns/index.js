'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';
'require poll';

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

		var m, s, o;

		m = new form.Map('akile-ddns', _('Akile DDNS'),
			_('自动检测本地公网 IPv4 变动。仅在 IP 发生变动时提交 PUT 请求更新白名单；保存配置后将立即执行一次检测同步。'));

		// Status Section
		s = m.section(form.NamedSection, 'main', 'global', _('运行状态'));
		s.anonymous = true;

		s.render = function() {
			var isRunning = (statusObj.RUNNING === '1');
			var statusBadge = isRunning
				? '<span class="label success" style="background:#28a745;color:#fff;padding:3px 8px;border-radius:4px;">运行中</span>'
				: '<span class="label warning" style="background:#6c757d;color:#fff;padding:3px 8px;border-radius:4px;">未运行</span>';

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
						ui.addNotification(null, E('p', _('检测已完成，请查看最新状态与日志。')), 'info');
						window.location.reload();
					}).catch(function(err) {
						ui.hideIndicator('akile_checking');
						ui.addNotification(null, E('p', _('检测执行异常: ') + err), 'error');
					});
				}
			}, _('立即检测并同步'));

			var table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'style': 'width:33%' }, _('服务状态')),
					E('td', { 'class': 'td left' }, E('span', {}, [ statusBadge, manualCheckBtn ]))
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
			]);

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('运行状态')),
				table
			]);
		};

		// Config Section
		s = m.section(form.NamedSection, 'main', 'global', _('基本设置'));
		s.anonymous = true;
		s.addremove = false;

		// Enabled
		o = s.option(form.Flag, 'enabled', _('启用服务'));
		o.default = '0';
		o.rmempty = false;

		// API Key
		o = s.option(form.Value, 'api_key', _('API Key'),
			_('填入 Akile API 密钥 (X-API-Key)，形如 ak_xxxx...。请妥善保管。'));
		o.password = true;
		o.rmempty = false;

		// Interval
		o = s.option(form.Value, 'interval', _('检测间隔 (分钟)'),
			_('定时检测公网 IP 变动的频率，默认 10 分钟。每次检测若 IP 未变化则不产生任何 API 请求。'));
		o.default = '10';
		o.datatype = 'and(uinteger, min(1))';

		// IP Source
		o = s.option(form.ListValue, 'ip_source', _('公网 IP 获取方式'),
			_('选择获取本机公网 IPv4 的方式，推荐自动多源轮询以确保稳定性。'));
		o.value('auto', _('自动多源轮询 (推荐)'));
		o.value('ipw', _('4.ipw.cn (国内高速)'));
		o.value('ipify', _('api4.ipify.org (国际常用)'));
		o.value('ipsb', _('api.ip.sb (Cloudflare网络)'));
		o.value('ifconfig', _('ifconfig.me'));
		o.value('custom', _('自定义 URL'));
		o.default = 'auto';

		// Custom IP URL
		o = s.option(form.Value, 'custom_ip_url', _('自定义 IP 接口'),
			_('输入返回纯文本 IPv4 地址的 HTTP(S) 地址'));
		o.depends('ip_source', 'custom');
		o.placeholder = 'https://api4.ipify.org';

		// Server & Port List Section
		s = m.section(form.NamedSection, 'main', 'global', _('转发规则与端口列表'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.DynamicList, 'server_list', _('规则列表 (IP:端口 或 端口)'),
			_('支持填入 <b>节点IP:端口</b> (例如 <code>103.152.220.1:10000</code> 或 <code>hk.akile.ai:20000</code>) 或直接填入 <b>纯端口</b> (例如 <code>10000</code>)。<br/>' +
			  '保存后插件会立即提取端口并查询更新规则；后续仅在检测到公网 IP 变化时才会进行 PUT 更改。'));
		o.placeholder = '103.152.220.1:10000 或 10000';
		o.rmempty = false;

		// Log View Section
		var logSection = m.section(form.NamedSection, 'main', 'global', _('运行日志'));
		logSection.anonymous = true;
		logSection.render = function() {
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

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('运行日志')),
				E('div', {}, [ logArea ]),
				E('div', {}, [ refreshBtn ])
			]);
		};

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var self = this;
		return this.handleSave(ev).then(function() {
			ui.showIndicator('akile_saving', _('正在保存并应用配置，立即触发首次 IP 检测...'));
			return fs.exec('/etc/init.d/akile-ddns', ['restart']).then(function() {
				return new Promise(function(resolve) { setTimeout(resolve, 2000); });
			}).then(function() {
				ui.hideIndicator('akile_saving');
				window.location.reload();
			}).catch(function(err) {
				ui.hideIndicator('akile_saving');
				ui.addNotification(null, E('p', _('重启服务失败: ') + err), 'error');
			});
		});
	}
});
