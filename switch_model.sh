#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./switch_model.sh <model_name>"
    echo "Example: ./switch_model.sh qwen3.5:9b"
    exit 1
fi

MODEL=$1

echo "==========================================="
echo "Switching Ollama model to $MODEL..."
echo "==========================================="

# 1. Pull the model first to ensure it's available
echo "--> Pulling $MODEL from Ollama..."
docker exec careergini-ollama ollama pull $MODEL

# 2. Update .env file
echo "--> Updating .env file..."
sed -i "s/^OLLAMA_MODEL=.*/OLLAMA_MODEL=$MODEL/" .env

# 3. Restart the services
echo "--> Recreating AI service container..."
docker compose up -d --build ai-service
echo "--> Restarting API Gateway..."
docker compose restart api-gateway

echo "==========================================="
echo "Successfully switched to $MODEL."
echo "Please wait a few seconds for the services to become healthy."
echo "==========================================="
