include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-akile-ddns
PKG_VERSION:=1.0.2
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=OpenWrt Akile DDNS

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-akile-ddns
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=LuCI support for Akile DDNS automatic whitelist update
	PKGARCH:=all
	DEPENDS:=+curl +ca-bundle
endef

define Package/luci-app-akile-ddns/description
	LuCI support for Akile DDNS. It monitors public IPv4 changes every 10 minutes (configurable) and automatically updates entry whitelists of Akile forwarding rules via open API.
endef

define Package/luci-app-akile-ddns/conffiles
/etc/config/akile-ddns
endef

define Build/Compile
endef

define Package/luci-app-akile-ddns/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/akile-ddns $(1)/etc/config/akile-ddns

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/akile-ddns $(1)/etc/init.d/akile-ddns

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./root/usr/bin/akile-ddns $(1)/usr/bin/akile-ddns

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-akile-ddns.json $(1)/usr/share/luci/menu.d/luci-app-akile-ddns.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-akile-ddns.json $(1)/usr/share/rpcd/acl.d/luci-app-akile-ddns.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/akile-ddns
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/akile-ddns/index.js $(1)/www/luci-static/resources/view/akile-ddns/index.js

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/controller/akile_ddns.lua $(1)/usr/lib/lua/luci/controller/akile_ddns.lua

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/model/cbi/akile_ddns.lua $(1)/usr/lib/lua/luci/model/cbi/akile_ddns.lua
endef

define Package/luci-app-akile-ddns/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/akile-ddns enable
	/etc/init.d/rpcd reload >/dev/null 2>&1
	exit 0
}
endef

define Package/luci-app-akile-ddns/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/akile-ddns disable
	/etc/init.d/akile-ddns stop
	exit 0
}
endef

$(eval $(call BuildPackage,luci-app-akile-ddns))
