package config

import (
	"github.com/edlingao/viover/internal/viover/adapters"
	"github.com/edlingao/viover/web"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

type Configurator struct {
	App adapters.App
}

func NewConfigurator() *Configurator {
	return &Configurator{}
}

func (c *Configurator) AddApp() *Configurator {
	c.App = *adapters.NewApp()

	return c
}

func (c *Configurator) Build() *Configurator {
	err := wails.Run(&options.App{
		Title:  "viover",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: web.StaticFiles,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        c.App.Startup,
		Bind: []any{
			&c.App,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
	return c
}
