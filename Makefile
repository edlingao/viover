.PHONY: dev build build-darwin clean

dev:
	wails dev

build: build-darwin

build-darwin:
	wails build -platform darwin/universal
	./build/darwin/bundle-ffmpeg.sh ./build/bin/viover.app

clean:
	rm -rf build/bin
