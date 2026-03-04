#!/bin/bash
set -e

DEFAULT_MODEL="qwen2.5:1.5b"

echo "==========================================="
echo "Rolling back Ollama model to $DEFAULT_MODEL..."
echo "==========================================="

# 1. Update .env file
echo "--> Updating .env file..."
sed -i "s/^OLLAMA_MODEL=.*/OLLAMA_MODEL=$DEFAULT_MODEL/" .env

# 2. Restart the AI service
echo "--> Recreating AI service container..."
docker compose up -d --build ai-service
echo "--> Restarting API Gateway..."
docker compose restart api-gateway

echo "==========================================="
echo "Successfully rolled back to $DEFAULT_MODEL."
echo "Please wait a few seconds for the services to become healthy."
echo "==========================================="
