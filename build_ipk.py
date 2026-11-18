#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-platform OpenWrt .ipk package builder
Generates luci-app-akile-ddns_1.0.0-1_all.ipk without requiring OpenWrt SDK.
"""

import os
import sys
import tarfile
import io
import hashlib

PKG_NAME = "luci-app-akile-ddns"
PKG_VERSION = "1.0.1-1"
PKG_ARCH = "all"
PKG_FILENAME = f"{PKG_NAME}_{PKG_VERSION}_{PKG_ARCH}.ipk"

CONTROL_CONTENT = f"""Package: {PKG_NAME}
Version: {PKG_VERSION}
Depends: curl, ca-bundle
Section: luci
Architecture: {PKG_ARCH}
Maintainer: OpenWrt Akile DDNS
Description: LuCI support for Akile DDNS. Monitors public IPv4 every 10 minutes and updates Akile rules entry whitelist.
"""

CONFFILES_CONTENT = "/etc/config/akile-ddns\n"

POSTINST_CONTENT = """#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	/etc/init.d/akile-ddns enable
	/etc/init.d/rpcd reload >/dev/null 2>&1
	exit 0
}
"""

PRERM_CONTENT = """#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	/etc/init.d/akile-ddns disable
	/etc/init.d/akile-ddns stop
	exit 0
}
"""

def create_tar_gz(items, is_control=False):
	buf = io.BytesIO()
	with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tar:
		for path, arcname, mode, content in items:
			ti = tarfile.TarInfo(name=arcname)
			ti.uid = 0
			ti.gid = 0
			ti.uname = "root"
			ti.gname = "root"
			ti.mode = mode
			ti.mtime = 1700000000

			if content is not None:
				ti.size = len(content)
				ti.type = tarfile.REGTYPE
				tar.addfile(ti, io.BytesIO(content))
			elif path and os.path.isfile(path):
				with open(path, "rb") as f:
					data = f.read()
				# Normalize line endings for shell scripts and configs to LF (\n)
				if arcname.endswith(('.sh', '.lua', '.json', '.js', 'akile-ddns')):
					data = data.replace(b'\r\n', b'\n')
				ti.size = len(data)
				ti.type = tarfile.REGTYPE
				tar.addfile(ti, io.BytesIO(data))
			elif path and os.path.isdir(path):
				ti.type = tarfile.DIRTYPE
				tar.addfile(ti)
	return buf.getvalue()

def build_ipk(base_dir, output_dir):
	root_dir = os.path.join(base_dir, "root")
	if not os.path.exists(root_dir):
		print(f"Error: root directory not found at {root_dir}")
		sys.exit(1)

	# 1. Prepare control.tar.gz
	control_items = [
		(None, "./control", 0o644, CONTROL_CONTENT.encode("utf-8").replace(b'\r\n', b'\n')),
		(None, "./conffiles", 0o644, CONFFILES_CONTENT.encode("utf-8").replace(b'\r\n', b'\n')),
		(None, "./postinst", 0o755, POSTINST_CONTENT.encode("utf-8").replace(b'\r\n', b'\n')),
		(None, "./prerm", 0o755, PRERM_CONTENT.encode("utf-8").replace(b'\r\n', b'\n')),
	]
	control_gz = create_tar_gz(control_items, is_control=True)

	# 2. Prepare data.tar.gz
	data_items = []
	for dirpath, dirnames, filenames in os.walk(root_dir):
		rel_dir = os.path.relpath(dirpath, root_dir).replace("\\", "/")
		if rel_dir != ".":
			data_items.append((dirpath, f"./{rel_dir}", 0o755, None))
		for f in filenames:
			full_path = os.path.join(dirpath, f)
			rel_path = os.path.relpath(full_path, root_dir).replace("\\", "/")
			arcname = f"./{rel_path}"
			# Executable permissions for init.d and bin scripts
			if "etc/init.d" in rel_path or "usr/bin" in rel_path:
				mode = 0o755
			else:
				mode = 0o644
			data_items.append((full_path, arcname, mode, None))

	# Sort entries for deterministic output
	data_items.sort(key=lambda x: x[1])
	data_gz = create_tar_gz(data_items)

	# 3. Prepare .ipk (outer tar.gz containing debian-binary, control.tar.gz, data.tar.gz)
	ipk_items = [
		(None, "./debian-binary", 0o644, b"2.0\n"),
		(None, "./control.tar.gz", 0o644, control_gz),
		(None, "./data.tar.gz", 0o644, data_gz),
	]
	ipk_bytes = create_tar_gz(ipk_items)

	out_path = os.path.join(output_dir, PKG_FILENAME)
	with open(out_path, "wb") as f:
		f.write(ipk_bytes)

	sha256 = hashlib.sha256(ipk_bytes).hexdigest()
	size_kb = len(ipk_bytes) / 1024.0

	print(f"Successfully generated OpenWrt package:")
	print(f"  Path:   {out_path}")
	print(f"  Size:   {size_kb:.2f} KB ({len(ipk_bytes)} bytes)")
	print(f"  SHA256: {sha256}")

	# Write sha256sums
	sha_path = os.path.join(output_dir, "sha256sums")
	with open(sha_path, "w", encoding="utf-8") as f:
		f.write(f"{sha256}  {PKG_FILENAME}\n")
	print(f"  Checksum written to: {sha_path}")

	return out_path

if __name__ == "__main__":
	base_dir = os.path.dirname(os.path.abspath(__file__))
	out_dir = base_dir
	build_ipk(base_dir, out_dir)
