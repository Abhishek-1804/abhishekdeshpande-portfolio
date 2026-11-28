---
title: "Thanksgiving Leftovers: Stolen Tokens, Shrinking Quotas, and a Quantum Act"
date: 2026-11-28T10:00:00-07:00
draft: false
tags:
  [
    "tech news",
    "security",
    "openai",
    "nvidia",
    "quantum",
    "github",
  ]
---

```
    ┌──────────────────────────────────────┐
    │   🥡  LEFTOVERS  (eat by Monday)     │
    │                                      │
    │   [ ] 1x SAP GitHub token, stolen    │
    │   [ ] GPT-6.2 quota, -40% portion    │
    │   [ ] Nvidia servers, do not ship    │
    │   [ ] EU Quantum Act, still warm     │
    │                                      │
    │   Reheat at your own risk.           │
    └──────────────────────────────────────┘
```

The turkey's gone, but the tech news fridge is packed. Here's what's still sitting in there this Saturday. Grab a fork. 🍴

---

## 🔑 1. SAP's GitHub Got Raided With Stolen Tokens

On Nov 26, **Der Spiegel** reported that attackers **stole SAP employees' authentication tokens** and used them to **copy and alter source code on GitHub**. It cited an internal memo and an insider. Spiegel also said the attackers **may have used AI agents**.

![SAP token attack path and response](/posts/thanksgiving-leftovers/token-heist.svg)

What we actually know:

- ✅ **SAP confirmed** it found "suspicious activity" and says there's **no evidence** so far that anyone got into **customer business data**.
- 🧯 **The response**, per Handelsblatt: SAP **restricted GitHub access**, **paused automated dev workflows**, and **swapped its signing keys**. Codename: **"Project Granite."**
- ❓ **Still unknown:** how the tokens leaked, which repos got hit, and the big one: did any tampered code **ship to customers**?

That signing key swap matters. If attackers can edit code *and* it gets signed, the bad code looks official.

```bash
$ gh auth status
✓ Logged in to github.com as totally-a-real-sap-engineer
✓ Token scopes: repo, workflow, write:packages
😬 Token owner: not the person typing
```

Your homework while the pie digests:

1. 🔄 **Rotate personal access tokens** you forgot existed.
2. ⏳ **Use short-lived tokens** (OIDC in CI) over long-lived ones.
3. ✍️ **Require signed commits** and protect `main`.

> MFA protects the login. A stolen token skips the login entirely.

---

## 🍽️ 2. OpenAI Shrank Your GPT-6.2 Portion

Since the **GPT-6.2** launch on Nov 17, OpenAI had been **undercounting** usage of its **Astra** and **Sol** models for most users. Product lead **Thibault Sottiaux** said on X that the launch had *incorrectly discounted* usage. Now it's fixed, and paying users hit their limits faster:

![Quota used by the same work, before and after the fix](/posts/thanksgiving-leftovers/quota-meter.svg)

| Model | Hits the limit... |
|---|---|
| **Astra** | ~**40%** faster |
| **Sol** | ~**25%** faster |
| Everything else | unchanged |

The make-good:

- 💸 **No back-charges** for the extra usage you already got.
- 🎟️ **One banked usage reset** for Go, Plus, Pro, and Business subscribers.

Not everyone was happy. Some users griped about the compensation and asked whether OpenAI has enough compute. Some said they're thinking about switching to **Claude**. 👀

```python
# billing.py, launch week
usage = tokens * 0.7   # TODO: remove before launch
```

> The first week was the free sample. The real price tag showed up after.

---

## 🚫 3. Nvidia Hits Pause on Four Countries

The **Financial Times** reported on Nov 26 that **Nvidia** told partners like **Dell** and **Supermicro** to **stop shipping AI servers** to **Malaysia, Singapore, Thailand, and Indonesia**.

The reason is a **US Commerce Department rule** released **Nov 16**. It requires **licenses** to ship advanced AI chips to those four countries plus **Brazil**, because the US sees a high risk of the chips ending up somewhere else. The real target is a **loophole**:

```
  before:   🇨🇳 company ──rents GPUs──▶ 🏢 SE Asia data center ──▶ 🟩 Nvidia chips  ✅
  after:    🇨🇳 company ──rents GPUs──▶ 🏢 SE Asia data center ──▶ 📝 license?     ⛔
```

- 📏 **The threshold:** You need a license if you rent "significant volumes" of compute to companies in **China, Russia, or Iran**. One report puts that at roughly **750 H100-class chips**.
- 📋 **Entity List:** Commerce also moved to blacklist Singapore's **Megaspeed International** and its affiliates in Malaysia and Thailand.
- 🤷 **The catch:** One report says there's **no guide yet** on how to apply for a license. Local companies like **Singtel** and **Indosat** get reviewed case by case.

> "Can't buy the GPUs? Just rent them!" Not anymore.

---

## ⚛️ 4. Europe Drops the Quantum Act

On **Nov 25**, the **European Commission** proposed the **EU Quantum Act** (officially **COM(2026) 965**). The goal: make Europe a quantum leader by **2030**. It has three parts:

| Pillar | Translation |
|---|---|
| 🔬 Research excellence | keep the labs funded |
| 🏭 Bring quantum into use | turn papers into products |
| 🔐 Secure systems & supplies | get ready for **post-quantum crypto** |

It comes with plans for a **Sovereign Tech Equity Fund** that covers quantum, AI, chips, and cloud. One outlet says it could reach **€50 billion**, but that number isn't confirmed. Early drafts also said public quantum contracts would mostly go to **EU-controlled** companies.

Before anyone gets excited: it's a **proposal**. The Parliament and Council still have to agree on it, and the **money gets decided in the 2028–2034 budget talks**.

Why devs should care: the EU already wants **critical infrastructure on post-quantum crypto by 2030**. Your RSA keys have a deadline.

```bash
$ openssl genrsa 2048
⚠️  this key is fine today
⚠️  this key is fine-ish in 2030
💀 this key vs. a big enough quantum computer
```

> Quantum computers can't break your crypto yet. The paperwork to replace it has already started.

---

## 🥡 TL;DR

| Leftover | When | Vibe |
|---|---|---|
| SAP GitHub tokens stolen | Nov 26 | 🔑 rotate your PATs |
| GPT-6.2 billing fix | ~Nov 26 | 🍽️ smaller portions, same price |
| Nvidia halts SE Asia shipments | Nov 26 | 🚫 rent-a-GPU loophole closed |
| EU Quantum Act proposed | Nov 25 | ⚛️ post-quantum clock is ticking |

Now go finish that pie before someone else does. 🥧
