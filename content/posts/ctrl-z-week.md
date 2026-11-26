---
title: "Ctrl+Z Week: Nvidia Undoes Its CEO, Java4Shell, and AI-Written Kernel Shields"
date: 2026-11-26T10:00:00-07:00
draft: false
tags:
  [
    "tech news",
    "nvidia",
    "java",
    "security",
    "ebpf",
    "ai",
  ]
---

```
    ┌──────────────────────────────────────┐
    │  $ history | tail -4                 │
    │                                      │
    │  rm -rf /nvidia/ceo     # nov 11     │
    │  base64 -d payload      # nov 17     │
    │  git revert HEAD        # nov 22     │
    │  for i in 1 2; do layers; done       │
    │                                      │
    │  ^Z  This week, everything got       │
    │      undone, redone, or run twice.   │
    └──────────────────────────────────────┘
```

Some weeks ship features. This one shipped **reverts**. A CEO got un-resigned, a Base64 decoder became an attack surface, and an AI model ran its own layers twice to look bigger. Quick hits below. ⚡

![Nov 11 to Nov 23 timeline](/posts/ctrl-z-week/ctrl-z-timeline.svg)

---

## ↩️ 1. Nvidia Hits Ctrl+Z on Its CEO

- **Nov 11:** Jensen Huang **resigns** as Nvidia's CEO and board member, effective immediately. CFO **Colette Kress** becomes interim CEO, and the board names its **first-ever Chair**, Harvey C. Jones.
- **Nov 12:** The stock drops as much as **14%** intraday, then closes down about 4%.
- **Nov 22:** The board **reinstates him** (it was announced Nov 23). The board says it received "input from senior levels of the United States government" and sees "no national security risk."

The backstory: Nvidia's own SEC filing says Huang had been **the target of a foreign intelligence effort**, and an independent committee is **still investigating**.

```bash
$ git log --oneline nvidia/ceo
a1b2c3d (HEAD) Revert "Remove jensen"    # nov 22
9f8e7d6 Remove jensen                    # nov 11
```

> Shortest CEO vacancy in megacap history? Not official. But it's a contender.

---

## ☕ 2. Java4Shell: When Base64 Bites

**CVE-2026-114938**, nicknamed **Java4Shell**, dropped Nov 17. It's a **heap memory corruption** bug in OpenJDK's **AVX-512 accelerated Base64 decoder**, and attackers can reach it **before authentication** to get remote code execution. Oracle and OpenJDK shipped fixes the same day.

The twist: it only fires on **x86-64 CPUs with AVX-512 VBMI**. In other words, your shiny new server is the one at risk.

```bash
# Does this box have the "vulnerable" superpower?
$ grep -o -m1 avx512vbmi /proc/cpuinfo
avx512vbmi        # 😬 patch me

# Which JVM is actually running? (not just installed)
$ java -version
```

**Survival guide:**

1. **Upgrade your JDK.** Temurin, Corretto, Zulu, and the rest all have fixed builds.
2. If you can't upgrade yet, a stopgap is turning off the intrinsic with `-XX:-UseBASE64Intrinsics`. Test it first.
3. ⚠️ Gotcha: **Elasticsearch and OpenSearch ignore `JAVA_TOOL_OPTIONS`**, so most copy-paste guides don't work for them.
4. **Bundled JDKs and Docker images don't patch themselves.** Rebuild them.

> Log4Shell walked so Java4Shell could... decode.

---

## 🛡️ 3. Shirudo: AI Agents Write Your Kernel Band-Aids

On Nov 23, **OpenAI and Cisco** open-sourced **Shirudo** (Japanese for "shield"). The idea: when a CVE drops and you can't patch yet, **AI agents write an eBPF "shield"** that blocks the exploit inside the running kernel. No reboot, no downtime.

```
  CVE drops ──► agent reads advisory ──► writes eBPF shield
                                              │
            human approves ◄── agent tests ◄──┘
                  │
                  ▼
        exploit blocked, app keeps running 🛡️
```

- It's an AI-focused **rewrite of Tetragon**, the eBPF security tool from Cisco-owned Isovalent.
- **Demo:** a Codex-generated shield stopped a **Java4Shell** exploit against a live Elasticsearch, without restarting it. (See #2. Good timing.)
- **Not production-ready yet.** It needs specific kernel features, extra kernel patches, and **TPM 2.0**.
- Skeptics, including security researcher Marcus Hutchins, ask the obvious question: do we want **AI writing rules that run in the kernel**?

> Virtual patching, but the intern is a language model. Humans still click "approve."

---

## 🔁 4. GLM-5.4: Same Layers, Twice

Also on Nov 23, **Z.ai** released **GLM-5.4**, its first flagship built on a **loop transformer**. Instead of adding more layers, it sends tokens through **the same stack of layers twice**.

![Normal vs loop transformer](/posts/ctrl-z-week/loop-transformer.svg)

```python
# normal transformer
for layer in layers:
    x = layer(x)

# loop transformer: same weights, more thinking
for _ in range(2):
    for layer in layers:
        x = layer(x)
```

- **Claim:** quality comparable to **2–3T-parameter** models. **No public benchmarks yet**, so ¯\\\_(ツ)\_/¯
- **Specs:** a **1M-token** context window and vision support.
- **Access:** only in Z.ai's own products (GLM Coding Plan, ZCode, Z.ai Chat) for now. Open weights are promised "after safety hardening," with no date given.

> Why pay for more parameters when you can just... think about it again?

---

## 📋 TL;DR

| What | When | Vibe |
|---|---|---|
| Nvidia CEO out → back in | Nov 11 → 22 | ↩️ `git revert` |
| Java4Shell (CVE-2026-114938) | Nov 17 | ☕💥 patch your JDKs |
| Shirudo (OpenAI + Cisco) | Nov 23 | 🛡️ AI-written eBPF shields |
| GLM-5.4 loop transformer | Nov 23 | 🔁 same layers, ×2 |

Now go patch your JVMs before the pie comes out. 🥧
