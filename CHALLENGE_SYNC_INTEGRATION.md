# Challenge Sync Integration Guide

## Overview
This guide explains how to integrate the Foto AI chatbot with the dashboard so that challenges generated in the chat automatically appear on the dashboard.

## Architecture

### 1. Sync API Endpoint
**Endpoint:** `POST https://myfoto.topues.com/api/challenges/sync`

**Purpose:** Receives challenge data from the chatbot and saves it to the PostgreSQL database.

**Request Body:**
```json
{
  "userId": "1",
  "challengeText": "Full challenge description here...",
  "category": "Street | Portrait | Landscape | Architecture | etc.",
  "difficulty": "Micro | Mini | Deep Dive",
  "duration": "15-20 mins | 1-2 hours | etc.",
  "location": "San Francisco, CA",
  "recommendedGear": ["Ricoh GR IIIx", "Fujifilm X-T5"],
  "tips": "Pro tips for the challenge",
  "weatherConditions": "Sunny, 72°F"
}
```

**Response:**
```json
{
  "success": true,
  "challenge": { /* challenge object */ },
  "created": true
}
```

### 2. Chatbot Integration Steps

You need to configure the Foto AI chatbot to call the sync API. Visit:
https://apps.abacus.ai/chatllm/13a86b8346

Add this instruction to the chatbot's system prompt:

"When you generate a photography challenge, automatically save it to the dashboard by making a POST request to https://myfoto.topues.com/api/challenges/sync with the challenge details. After successful sync, tell the user: 'Challenge saved to your dashboard!'"

### 3. Testing the Integration

Test the sync API:
```bash
curl -X POST https://myfoto.topues.com/api/challenges/sync \
  -H "Content-Type: application/json" \
  -d '{"userId":"1","challengeText":"Test challenge","category":"Street","difficulty":"Micro","duration":"15 mins"}'
```

## Current Status

✅ Sync API endpoint created
✅ Database schema supports all challenge fields
✅ Dashboard loads challenges on page load
⏳ Chatbot integration pending (requires manual configuration)

