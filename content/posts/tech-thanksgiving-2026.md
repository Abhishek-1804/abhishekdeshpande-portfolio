---
title: "Tech Thanksgiving: 6 Things Devs Are (and Aren't) Grateful For This November"
date: 2026-11-26T09:00:00-07:00
draft: false
tags:
  [
    "tech news",
    "rust",
    "postgresql",
    "llama.cpp",
    "ai",
    "security",
  ]
---

```
    ┌──────────────────────────────────────┐
    │  $ git log --since="nov 1"           │
    │                                      │
    │  ✔ rust 1.100      never type lands  │
    │  ✔ llama.cpp 1.0   semver, finally   │
    │  ✔ gpt-6.2         astra + sol       │
    │  ✔ postgres 19     REPACK all day    │
    │  ✔ $ANT            rings the bell    │
    │  ✘ binance         -$6,300,000,000   │
    │                                      │
    │  Pass the gravy. And the changelog.  │
    └──────────────────────────────────────┘
```

It's Thanksgiving, which means one thing: you'll be asked to fix a relative's printer. Before that happens, here's what the tech world served up this month. Short, sweet, gravy on the side.

![November 2026 tech timeline](/posts/tech-thanksgiving-2026/november-timeline.svg)

---

## 🙏 1. Rust 1.100: The `!` Type Is Finally Stable

After roughly a **decade** and several failed attempts, the never type (`!`) is stable in **Rust 1.100** (Nov 12). You can now use it anywhere a type goes:

```rust
fn crash_and_burn() -> ! {
    panic!("the turkey is still frozen");
}

// A Result that can literally never be Err
fn always_works() -> Result<u32, !> {
    Ok(42)
}
```

Also in the box: core parts of the **Allocator API**, and Cargo can now flag **unused dependencies**.

**Bonus chaos:** the version number itself. Any script comparing versions as strings is about to have a bad day:

```bash
$ printf '1.9\n1.100\n' | sort
1.100      # 💀 sorted as older than 1.9
1.9

$ printf '1.9\n1.100\n' | sort -V
1.9
1.100      # ✅ version-aware sort
```

> Grateful for: `sort -V`.

---

## 🙏 2. llama.cpp Hits 1.0 (Semver, Who Dis?)

The local-LLM workhorse shipped **v1.0.0** on Nov 13, alongside ggml 1.0. The headline isn't a flashy feature. It's a **promise**: from now on, an API/ABI break means a major version bump.

To celebrate, it... broke the API. About three dozen deprecated C functions got removed, and it added an **FP8 KV cache** so your laptop's RAM can breathe a little.

> Grateful for: version numbers that actually mean something.

---

## 🙏 3. GPT-6.2 Astra & Sol

OpenAI shipped **GPT-6.2** on Nov 17 as two models: **Astra** (frontier model for long, hard projects) and **Sol** (efficient everyday model). This came about two months after it **scrapped GPT-6.1 Astra over safety concerns**. Astra's API price also dropped **20%**.

```
  6.0 ──► 6.1 ──✂──► 6.2
          (skipped leg day)
```

> Grateful for: cheaper tokens. Every. Single. Time.

---

## 🙏 4. PostgreSQL 19: `REPACK` Goes Mainstream

Postgres 19 landed on Nov 19, and the star is **`REPACK`**, one command that rolls up `VACUUM FULL` *and* `CLUSTER`. Add `CONCURRENTLY` and your table keeps taking reads and writes while it gets de-bloated:

```sql
-- Before: VACUUM FULL orders;  (table locked, everyone waits 😬)
REPACK (CONCURRENTLY) orders;

-- Rewrite in index order, still online
REPACK (CONCURRENTLY) orders USING INDEX orders_created_at_idx;
```

Basically, `pg_repack`/`pg_squeeze` got promoted to core. Also new: parallel index vacuuming for autovacuum and `pg_plan_advice` for nudging the planner.

⚠️ PSA: **PostgreSQL 14 stopped getting fixes on Nov 12.** Time to upgrade.

> Grateful for: never explaining table bloat to a PM again.

---

## 🙏 5. Anthropic Rings the Bell (`$ANT`)

The company behind Claude priced its IPO at **$83/share** on Nov 18 and started trading on Nasdaq on Nov 19, raising about **$81B**, the **biggest IPO on record**. It closed day one at **$97.17** (+17%), then cooled off a bit the next morning.

```
  $115 ┤        ╭╮   ← intraday high
  $111 ┤  open ─╯╰╮
   $97 ┤          ╰──── close (+17%)
   $83 ┼─────────────── IPO price
```

> Grateful for: AI hype finally having a ticker symbol you can refresh obsessively.

---

## 😬 6. Not Grateful: The $6.3 Billion Binance Heist

Around Oct 29, roughly **$6.3B** in crypto walked out of **Binance**, the largest crypto theft ever recorded. On Oct 31 the **FBI pinned it on North Korea's "TraderTraitor"** group. US authorities have since seized or frozen **more than $1.2B** of it, and Binance says it has refilled most of the affected assets.

The lesson, yet again:

```
  security = ∏ (every link in the chain)
           = 0   if any link == 0
```

> Not grateful for: the reminder that "not your keys, not your coins" is still undefeated.

---

## 🥧 TL;DR

| What | When | Vibe |
|---|---|---|
| Rust 1.100 (`!` stable) | Nov 12 | 🎉 a decade later |
| llama.cpp 1.0 | Nov 13 | 🧱 stable APIs |
| GPT-6.2 Astra/Sol | Nov 17 | 🤖 cheaper and faster |
| PostgreSQL 19 (`REPACK`) | Nov 19 | 🐘 bloat be gone |
| Anthropic IPO (`$ANT`) | Nov 19 | 📈 +17% day one |
| Binance heist | Oct 29–Nov | 🏴‍☠️ $6.3B gone |

Now go eat. And if anyone asks you to "just quickly look at" their Wi-Fi, you didn't read this. 🦃
