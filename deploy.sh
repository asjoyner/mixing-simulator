#!/bin/bash

# Configuration
DEST_DIR="/var/www/html/mixing/"
BUILD_DIR="dist"

echo "Starting build and deploy process..."

# 1. Build the project
echo "Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "Error: Build failed."
    exit 1
fi

# 2. Deploy to destination
echo "Deploying to $DEST_DIR..."

# Check if destination exists, create if not (might need sudo)
if [ ! -d "$DEST_DIR" ]; then
    echo "Destination directory does not exist. Attempting to create..."
    mkdir -p "$DEST_DIR"
    if [ $? -ne 0 ]; then
        echo "Error: Could not create destination directory. You may need to run this script with sudo."
        exit 1
    fi
fi

# Copy files
cp -r $BUILD_DIR/* "$DEST_DIR"

if [ $? -eq 0 ]; then
    echo "Successfully deployed to $DEST_DIR"
else
    echo "Error: Failed to copy files. Check permissions."
    exit 1
fi
