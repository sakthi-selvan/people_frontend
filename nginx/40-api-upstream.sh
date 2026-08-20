#!/bin/sh
set -e
# Only substitute API_UPSTREAM so nginx variables like $host stay intact.
: "${API_UPSTREAM:=http://api:4100}"
export API_UPSTREAM
envsubst '${API_UPSTREAM}' \
  < /etc/nginx/api.conf.template \
  > /etc/nginx/conf.d/default.conf
