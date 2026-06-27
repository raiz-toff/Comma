#!/bin/bash
set -e

# Configuration
DATA_DIR="/home/coder/valhalla_data"
PORT=8002

# Default regions (US & Canada - space separated)
OSM_URLS="https://download.geofabrik.de/north-america/us-latest.osm.pbf https://download.geofabrik.de/north-america/canada-latest.osm.pbf"

# Allow overriding region via argument
if [ -n "$1" ]; then
    OSM_URLS="$1"
fi

echo "🚀 Setting up local Valhalla Map Matching Service..."
echo "📂 Data Directory: $DATA_DIR"
echo "🌐 OSM Region URLs: $OSM_URLS"

# Create directories
mkdir -p "$DATA_DIR"

# Run GIS-OPS Valhalla Docker container
# The container will automatically download the pbf files, merge them, compile the tiles, and serve the API
docker run -d \
  --name valhalla_map_matching \
  -p $PORT:8002 \
  -v "$DATA_DIR":/custom_files \
  -e tile_urls="$OSM_URLS" \
  -e build_tar=True \
  -e serve_tiles=True \
  --restart unless-stopped \
  ghcr.io/gis-ops/docker-valhalla/valhalla:latest

echo "✅ Valhalla container started in background as 'valhalla_map_matching'!"
echo "⏳ It is now downloading and compiling tiles. Since USA and Canada are large, this will take some time to download and build."
echo "📜 Check progress with: docker logs -f valhalla_map_matching"
echo "🔌 API will be exposed on: http://localhost:$PORT"
