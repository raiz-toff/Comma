#!/bin/bash

# Port
PORT=8002

echo "🧪 Querying local Valhalla map matching endpoint..."

# Coordinates in San Francisco, CA, USA
JSON_DATA='{
  "shape": [
    {"lat": 37.7749, "lon": -122.4194},
    {"lat": 37.7753, "lon": -122.4180},
    {"lat": 37.7757, "lon": -122.4166}
  ],
  "costing": "auto",
  "shape_match": "map_snap"
}'

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA" \
  "http://localhost:$PORT/trace_route")

if echo "$RESPONSE" | grep -q "trip"; then
  echo "✅ Success! Valhalla Map Matching is working!"
  echo "🗺️ Snapped route geometry returned successfully."
else
  echo "❌ Failed to match route. Response:"
  echo "$RESPONSE"
fi
