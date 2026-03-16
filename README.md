# Synthetic Audience Message Tester

Test your campaign messaging against three AI-powered ICR buyer personas before spending a dollar on media.

**Personas:** Marcus (Platform Engineer) · Priya (Data Scientist) · David (VP Engineering)

**What it does:** Paste any message — headline, value prop, email opener, ad copy — and get structured scoring across Comprehension, Resonance, and Differentiation from all three personas simultaneously. Includes a Rationalization Signal alert if scores cluster too closely (campaign consolidation evidence).

---

## Deploy to Vercel in 5 Steps

### Step 1 — Get your Claude API key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in (or create an account)
3. Go to **API Keys** → **Create Key**
4. Copy the key — you'll need it in Step 4

> Cost estimate: Each test run makes 3 API calls. At Claude Sonnet pricing, expect ~$0.01–0.03 per test run.

### Step 2 — Put the project on GitHub
1. Create a new **private** repository on [github.com](https://github.com)
2. Copy the contents of this `synthetic-audience-app` folder into that repo
3. Push to GitHub

### Step 3 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in (free account works)
2. Click **Add New → Project**
3. Import your GitHub repository
4. Vercel will auto-detect it as a Next.js project — no configuration needed

### Step 4 — Add your API key as an environment variable
In the Vercel project settings **before** deploying:
1. Go to **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from Step 1
   - **Environment:** Production (and optionally Preview)
3. Click **Save**

### Step 5 — Deploy
Click **Deploy**. Vercel builds and publishes it. You get a URL like `https://your-project.vercel.app`.

---

## Run Locally (optional)

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.local.example .env.local
# Then edit .env.local and add your ANTHROPIC_API_KEY

# 3. Start the dev server
npm run dev

# Open http://localhost:3000
```

---

## Customizing the Personas

Persona system prompts live in `/app/api/test-message/route.ts` in the `personas` array. Each persona has:
- `name`, `role`, `company` — displayed in the UI
- `avatar` — 2-letter code for the avatar circle
- `systemPrompt` — the full persona definition

To update a persona (e.g., adjust the ICP as it evolves), edit the `systemPrompt` field and redeploy.

---

## Project Structure

```
synthetic-audience-app/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main UI
│   ├── globals.css         # Tailwind base styles
│   └── api/
│       └── test-message/
│           └── route.ts    # Claude API calls (server-side)
├── .env.local.example      # Template — copy to .env.local
├── .gitignore              # Excludes .env.local from git
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

*Built for NetApp ICR campaign rationalization work · March 2026*
