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

# For aarch64-unknown-linux-musl, napi-rs sets the Cargo linker variable to
# aarch64-linux-musl-gcc, a cross-compile linker. This variable overrides
# .cargo/config.toml, and Alpine does not have that linker. This build is
# native, so set the linker to clang, as .cargo/config.toml does. napi-rs
# does not change a linker variable that is already set.
linker_var="CARGO_TARGET_$(printf '%s' "$target" | tr 'a-z-' 'A-Z_')_LINKER"
export "${linker_var}=clang"

node_modules/.bin/napi build --platform --release --output-dir src --no-js \
	--dts generated-napi.d.ts --target "$target"
node_modules/.bin/tsdown
cp src/qrbit.*.node dist/
node_modules/.bin/vitest run --coverage
