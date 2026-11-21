#!/bin/sh
# ci-alpine-build.sh: Build the native binding and run the tests in an
# Alpine (musl) container.
#
# CI runs this script with `docker run` on a Linux arm64 runner. GitHub
# Actions cannot run JavaScript actions in an Alpine job container on arm64,
# thus the job cannot use `container:`. The runner installs node_modules
# with `sfw pnpm install --libc=musl` before this script starts. Thus this
# script does not install npm packages.
#
# Usage: sh scripts/ci-alpine-build.sh <rust-target>

set -eu

if [ "$#" -ne 1 ]; then
	echo "usage: sh scripts/ci-alpine-build.sh <rust-target>" >&2
	exit 1
fi
target="$1"

apk add --no-cache build-base clang rustup
rustup-init -y --no-modify-path --profile minimal --default-toolchain stable --target "$target"
PATH="${HOME}/.cargo/bin:${PATH}"
export PATH

node_modules/.bin/napi build --platform --release --output-dir src --no-js \
	--dts generated-napi.d.ts --target "$target"
node_modules/.bin/tsdown
cp src/qrbit.*.node dist/
node_modules/.bin/vitest run --coverage
