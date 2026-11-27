---
title: "Black Friday Doorbusters: 10x RAM, a Million Satellites, and Claude Rewrites Claude"
date: 2026-11-27T00:30:00-07:00
draft: false
tags:
  [
    "tech news",
    "hardware",
    "spacex",
    "rust",
    "anthropic",
    "security",
  ]
---

```
    ┌──────────────────────────────────────┐
    │  $$$ BLACK FRIDAY DOORBUSTERS $$$    │
    │                                      │
    │  32GB DDR5 ........ $439  (on sale)  │
    │  1,000,000 sats ... FCC approved     │
    │  Python API ....... -70% CPU         │
    │  AI pentest bot ... free (uh oh)     │
    │                                      │
    │  No returns. No refunds. No RAM.     │
    └──────────────────────────────────────┘
```

Happy Black Friday! While everyone's fighting over TVs, the tech world dropped its own doorbusters this week. Some are deals. Most are... not. 🛒

---

## 🧠 1. RAM Is the New GPU (Prices Up to 10x)

The **Wall Street Journal** reported on Nov 26 that some memory chip prices are up **tenfold** in a year. Companies are setting up actual **procurement war rooms** for it:

- Staff spend **six days a week** cold-calling hundreds of brokers for leftover stock.
- Some buyers are scouring **eBay** and buying batches as small as **5 to 12 chips**.
- One PC maker had suppliers back out of deals, so it **cut the RAM in preordered PCs**. Some of its high-end desktops now cost about **70% more**.

The cause? **AI data centers.** They're expected to use **more than 70%** of all high-end memory made in 2026. Samsung, SK Hynix, and Micron make most of the world's supply, and relief isn't expected until new factories open in **2028**.

What that means for today's "deals":

```bash
$ black-friday --search "32GB DDR5-6000"
💸 Cheapest kit:  $439.99   (was $549.99)
🏷️  Discount:      20% off
😐 Vibe:          still pricier than the turkey. by a lot
```

> Download more RAM? It's honestly the cheaper option now.

---

## 🛰️ 2. FCC to SpaceX: Sure, Have a Million Satellites

On Nov 25, the FCC gave SpaceX **conditional approval** for **Starmind**: up to **1,000,000 satellites** that work as **AI data centers in orbit**. The FCC says it's the first approval of its kind in U.S. history. The idea: process data in space, beam the results back down.

![Starmind deployment milestones](/posts/black-friday-doorbusters/starmind-milestones.svg)

The fine print:

- **Altitude:** Approved for **500 to 1,002 km**. SpaceX asked for up to 2,000 km.
- **Debris:** The FCC only signed off on the debris plan **below 600 km**. To go higher, SpaceX has to file again.
- **Deadlines:** Miss a milestone and the license is **void**.
- **Haters:** Amazon called it "lofty ambition rather than a real plan." Viasat and the American Astronomical Society also asked the FCC to say no. Astronomers are worried about the night sky.

```
  your cloud region in 2040:

   us-east-1      eu-west-1      leo-shell-7 🛰️
   (Virginia)     (Ireland)      (550 km straight up)
```

> Finally, a cloud that's actually in the clouds. Latency: ✨ orbital ✨.

---

## 🦀 3. Claude Rewrote Claude's Own API in Rust

On Nov 25, **Anthropic** shared how it used **Claude agents** to move its **Messages API** (the service every Claude request goes through) from **Python to Rust**. They did it while traffic was exploding, up roughly **1,800x** since early 2024.

The reported results:

| Metric | Change |
|---|---|
| CPU per request | **~70% less** |
| Memory per request | **80%+ less** |
| Median time to first token | **~20% faster** |
| Downtime | **zero** |

The clever part wasn't the rewrite. It was **proving the rewrite was right**. They used **shadow traffic**: Python kept answering customers, while a copy of each request went to Rust, and a verifier compared the two step by step.

![Shadow traffic verification](/posts/black-friday-doorbusters/shadow-traffic.svg)

When the agents picked the wrong fix, engineers turned the correction into a **rule** for later agents to follow. Public traffic moved to Rust in **September**.

⚠️ One caveat: in a podcast interview, the platform lead gave a smaller **40–50%** CPU saving. So the exact number depends on who's counting.

```rust
// The meme writes itself
fn rewrite_it_in_rust(service: Python) -> Rust {
    claude.agents().rewrite(service).verify_with_shadow_traffic()
}
```

> "Rewrite it in Rust" used to be a meme. Now it's a prompt.

---

## 🕵️ 4. ARTEX: The Free AI Pentester That Hackers Grabbed

On Nov 26, **Microsoft** said at least **six hacking groups** are using **ARTEX**, an open-source **AI penetration-testing** tool. They include China's **Salt Typhoon** and North Korea's **Onyx Sleet**.

- **Origin:** Posted to GitHub on **July 26** by a developer called **Autumn-27**, under the AGPL-3.0 license. It was built for *authorized* testing.
- **How it works:** A "planner" AI breaks a goal into tasks, and "worker" AIs carry them out: scanning, password attacks, and breaking in.
- **The scary bit:** In some cases it reached **admin-level access in minutes**.
- **The not-so-scary bit:** Microsoft says it uses **no new tricks**, just well-known tools, running at machine speed.

```
  2026-07  🧑‍💻 "Here's my AI pentest tool for the good guys!"
  2026-11  🕵️ the not-good guys: "Thanks!"
```

Since it uses old tricks, the old defenses still work:

1. 🔑 **Rotate leaked secrets.** Exposed API keys and tokens are its easiest way in.
2. 🛡️ **Turn on MFA everywhere**, especially for admin accounts.
3. 🩹 **Patch internet-facing stuff first.** The bot finds the easy targets fastest.

> Same old attacks, now with a robot that never takes a lunch break.

---

## 🛍️ TL;DR

| Doorbuster | When | Vibe |
|---|---|---|
| Memory prices up to 10x | Nov 26 | 🧠💸 war rooms for RAM |
| Starmind: 1M satellites OK'd | Nov 25 | 🛰️ cloud, literally |
| Messages API Python → Rust | Nov 25 | 🦀 -70% CPU, 0 downtime |
| ARTEX used by state hackers | Nov 26 | 🕵️ rotate your keys |

Now go fight someone for a TV. Just don't check what the RAM inside it cost. 📺
