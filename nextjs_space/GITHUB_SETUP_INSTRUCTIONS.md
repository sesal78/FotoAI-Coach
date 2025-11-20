
# GitHub Setup Instructions for Foto-AI-Agent-DeepAgent

## Step 1: Create the Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in to your account (sesal78)
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `Foto-AI-Agent-DeepAgent`
   - **Description**: AI-powered photography coaching web application with personalized itineraries and daily challenges
   - **Visibility**: ✅ **Private**
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## Step 2: Push Your Code to GitHub

Once you've created the repository, run these commands in your terminal:

```bash
cd /home/ubuntu/foto_app/nextjs_space

# Add the GitHub remote
git remote add origin https://github.com/sesal78/foto-photography-coach.git

# Push your code to GitHub
git push -u origin master
```

You'll be prompted for your GitHub credentials:
- **Username**: sesal78
- **Password**: Use a **Personal Access Token** (NOT your GitHub password)

### If you don't have a Personal Access Token:

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name (e.g., "Foto App Upload")
4. Select scopes:
   - ✅ `repo` (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token immediately** (you won't see it again)
7. Use this token as your password when pushing

## Step 3: Verify the Upload

After pushing, you should see your code at:
https://github.com/sesal78/foto-photography-coach

---

## Manual Sync Commands (For Future Updates)

Whenever you make changes to your code, use these commands to sync with GitHub:

### Check Status
```bash
cd /home/ubuntu/foto_app/nextjs_space
git status
```

### Stage All Changes
```bash
git add -A
```

### Commit Changes
```bash
git commit -m "Your commit message describing the changes"
```

### Push to GitHub
```bash
git push origin master
```

### Pull Latest Changes (if working from multiple locations)
```bash
git pull origin master
```

---

## Quick Sync Script

I've created a helper script for easy syncing:

```bash
cd /home/ubuntu/foto_app/nextjs_space
chmod +x sync.sh
./sync.sh "Your commit message"
```

This will automatically add, commit, and push your changes.

---

## Troubleshooting

### Authentication Failed
- Make sure you're using a **Personal Access Token**, not your GitHub password
- Verify the token has `repo` scope

### Permission Denied
- Check that the repository is created under your account (sesal78)
- Verify the remote URL: `git remote -v`

### Already Exists Error
- If the repository already exists, you can just add the remote and push:
  ```bash
  git remote add origin https://github.com/sesal78/foto-photography-coach.git
  git push -u origin master
  ```

---

Need help? Let me know!
