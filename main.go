package main

import "github.com/edlingao/viover/config"

func main() {
	config.
		NewConfigurator().
		AddApp().
		Build()
}
