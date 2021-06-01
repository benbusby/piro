all: cargo

cargo:
	cargo build

arm:
	cross build --target armv7-unknown-linux-gnueabihf
