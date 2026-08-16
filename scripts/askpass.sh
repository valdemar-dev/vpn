#!/bin/sh
# passwd dialog for sudo
if command -v kdialog >/dev/null 2>&1; then
  kdialog --title "VPN Manager" --password "Enter your sudo password to authorize VPN Manager"
  exit $?
fi
if command -v zenity >/dev/null 2>&1; then
  zenity --password --title "VPN Manager needs root" 2>/dev/null
  exit $?
fi

# read asked passwd if we could not use dialog.
cat "$VPN_ASKPASS_FILE"