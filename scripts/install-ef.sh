#!/usr/bin/env bash
# Install dotnet-ef global tool.
set -e
export PATH="$HOME/dotnet:$PATH"
export PATH="$HOME/.dotnet/tools:$PATH"
dotnet tool install --global dotnet-ef --version 10.0.9 2>&1 || echo "(already installed, ok)"
dotnet ef --version
