package web

import "embed"

//go:embed app/dist/*
var StaticFiles embed.FS
