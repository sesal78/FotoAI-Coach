
#!/bin/bash

# Foto Photography Coach - Git Sync Script
# Usage: ./sync.sh "Your commit message"

# Check if commit message is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a commit message"
    echo "Usage: ./sync.sh \"Your commit message\""
    exit 1
fi

echo "📸 Foto Photography Coach - Git Sync"
echo "======================================"
echo ""

# Check for changes
echo "🔍 Checking for changes..."
git status --short

# Stage all changes
echo ""
echo "📦 Staging changes..."
git add -A

# Check if there are any changes to commit
if git diff-index --quiet HEAD --; then
    echo "✅ No changes to commit"
    exit 0
fi

# Commit changes
echo ""
echo "💾 Committing changes..."
git commit -m "$1"

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
git push origin master

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully synced to GitHub!"
    echo "🌐 View at: https://github.com/sesal78/Foto-AI-Agent-DeepAgent"
    echo "📊 Commit: $(git log -1 --pretty=format:'%h - %s')"
else
    echo ""
    echo "❌ Push failed. Please check your credentials and try again."
    exit 1
fi
