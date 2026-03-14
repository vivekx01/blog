---
title: "Caching Strategies in Distributed Systems: From Basics to Pitfalls"
description: "Why basic TTL isn't enough, how expiry causes traffic spikes, and practical strategies: jitter, early expiration, mutex locking, SWR, and cache warming, with clear tradeoffs and when to use which."
date: "2026-03-14"
category: "System Design"
series: "System Design Series"
seriesOrder: 2
draft: false
---

Caching cuts latency and load, but "set a TTL and forget" often backfires. Here's why basic TTL isn't enough and which strategies to use instead. Kept short so you can skim and still take away the essentials.

## Why Basic TTL Caching Isn't Enough

Let's say you have an app that's very read-heavy. You set a TTL on the keys in cache, for example, "cache for 5 minutes, then expire." It works when traffic is low, but once you hit spikes, this approach can come crashing down.

The problem is that all keys share the same 5-minute clock. If many keys were cached around the same time, they expire around the same time too. When that happens, the DB load spikes: every request that was happily hitting cache suddenly misses and hits the database. If the spike is big enough, the DB can max out or even crash.

The other problem is control. With a naive TTL, you don't get to decide:

- **When** expiry happens: same moment for everyone, or spread out?
- **Who** refills the cache: every request that misses, or just one?
- **What** users see during refill: errors, loading spinners, or stale data?

<!-- IMAGE: Simple diagram – app, cache (single TTL clock), DB; all keys expire at the same moment. Path: /blog/system-design/caching-basic-ttl-problem.png -->

## How Cache Expiry Causes Traffic Spikes

Suppose you have a key in cache that loads data for your homepage. That key gets a lot of requests every second, and you've set a 5-minute TTL on it. When the key expires after 5 minutes, the next request gets a cache miss and goes to the DB. Another request comes in meanwhile (while the first is still fetching), and it misses too, so it also hits the DB. With two requests it looks trivial. But what if 100 requests arrive in that same split second, before the cache is refilled? The DB has to serve all of them. That's a spike. That's what we call a **thundering herd**.

So the mechanism is:

1. **Same key, same TTL:** everyone's idea of when it expires is the same.
2. **Expiry moment:** the first request after that moment misses, and so do the next 999 until the cache is filled again.
3. **No coordination:** no one says "I'll refill, the rest of you wait." They all try to refill.
4. **Result:** a traffic spike at the backend for that key. If the backend is a DB, it's a DB spike; if it's an API, it's an API spike.

Next we will discuss the strategies we can use to prevent such issues in our systems.

<!-- IMAGE: Timeline or sequence – many requests, one cache key expires, all arrows hit DB at once (cache stampede). Path: /blog/system-design/caching-expiry-traffic-spike.png -->

## TTL Jitter: Adding Randomness to Expiration

So far, everything we've discussed points to one cause of spikes: all keys share the same TTL. The simplest fix is to design the logic so that keys don't all expire at the same time, i.e. spread expiry out by adding some **jitter**.

**How jitter works:** Whatever TTL you choose, you add or subtract a random delta. For example, with a 5-minute TTL the system might randomly use 4 min 30 s (5 min minus 30 s) or 5 min 15 s (5 min plus 15 s). Keys no longer expire in lockstep.

You change the expiry you store when setting the value, for example:

1. `expires_at = now + 5_minutes + random(-30s, +30s)`, or
2. `ttl = 5_minutes + random(0, 60s)` (only adding so you never expire before 5 minutes, depends how strict you want to be).

Expiry is spread over a window, so the spike is smoothed out and you get fewer simultaneous misses.

**What it fixes:** Many keys no longer expire at once, which avoids thundering herd from synchronized expiry.

**What it doesn't fix:** For one hot key, you can still get many requests at once when that key's jittered expiry hits. So jitter is often combined with something like cache locking or a mutex (we'll cover that next) so only one request refills.

<!-- IMAGE: Before/after – left: all keys expire at T; right: expiry spread over T±jitter window (staggered bars or timeline). Path: /blog/system-design/caching-ttl-jitter.png -->

## Probability-Based Early Expiration

The next strategy, as the name suggests, is **probability-based early expiration**. What does that mean? Suppose you have a key in cache that is not yet expired but will expire in a few minutes. While serving the request from cache, the logic decides with some probability (e.g. a threshold or random roll) whether to *also* trigger a refresh for that value in the background. You still return the cached value immediately. The refresh is asynchronous. Over time, a random subset of requests triggers a refresh before the TTL, so refills are spread over the window instead of all happening at the expiry moment. That **smooths the spike** on the backend: the cache keeps serving while refreshes happen in the background, and you avoid a thundering herd at the exact expiry time.

**Tradeoff:** You might refresh more often than strictly necessary, so average load on the backend can be slightly higher, in exchange for smoother load and fewer thundering-herd moments.

**Typical implementation:**

1. On cache hit, check how old the entry is (`age = now - cached_at`).
2. If age is in an "early refresh" window (e.g. the last 1–2 minutes of the TTL), with probability **p** trigger a background refresh before expiry. That's probability-based early expiration, or "early refresh."
3. You're not forcing every request to refill. You're letting a random subset of requests trigger a refresh before expiry.

<!-- IMAGE: Diagram – request hits cache, with probability p trigger background refresh before TTL; or simple "early refresh window" timeline. Path: /blog/system-design/caching-probabilistic-early-expiry.png -->

## Mutex / Cache Locking: Preventing Duplicate Recomputation

When a single hot key expires and causes a thundering herd, the real pain is that hundreds of requests rush to the backend to refill the cache. **Cache locking** adds a simple rule: only one request is allowed to refill the cache for a given key. Everyone else either waits briefly or serves stale data. So instead of N requests causing N DB hits, you get **one** DB hit.

**How it works:**

1. **Request A** hits the cache, sees a miss (or expiry), and tries to acquire a lock for that cache key.
2. If it gets the lock, it becomes the leader: fetches from the DB, sets the cache, then releases the lock.
3. **Requests B…N** arrive at the same time: they try to acquire the lock, fail (because A holds it), and so they don't all rush to refill. They either wait until the refill is done or serve stale data until then.

**Tradeoff:** Either latency increases slightly for some requests (if they wait), or users see stale data until the refill completes. In return, the backend sees one refill instead of a stampede.

<!-- IMAGE: Sequence – request 1 gets lock, goes to DB, fills cache; requests 2–N wait or read stale, then get fresh after lock release. Path: /blog/system-design/caching-mutex-lock.png -->

## Stale-While-Revalidate (SWR)

When the cache entry is expired (or missing), you could block the user until you refill. **SWR** says: don't block. Return the stale value immediately and trigger a refresh in the background. The next request gets the fresh data. **Serve stale now, revalidate in the background.**

**How it works:**

1. Request comes in; you look up the key in cache.
2. If there's a value (even expired), return it right away (no wait).
3. If the value is expired (or in an early-refresh window), also kick off an async job to refill the cache.
4. The user who got the stale response is already done. Later requests get the refreshed value, or if they arrive before the refill finishes, they get the stale value too (and may trigger another revalidate).

**Why use it:** Latency is never compromised. You always serve from cache. You avoid significant spikes because you're not blocking N requests on one refill. Good for UX in read-heavy, user-facing systems where "eventually fresh" is acceptable.

<!-- IMAGE: Flow – return stale from cache immediately, async arrow to backend for revalidate; next request gets fresh. Path: /blog/system-design/caching-stale-while-revalidate.png -->

## Cache Warming / Pre-Warming

Right after a deploy, or when traffic first hits, the cache is empty. The first N requests all miss, hit the DB, and you get a spike or a slow cold start. **Cache warming** means filling the cache before (or as) traffic arrives so the first real users get hits, not misses.

**When it helps:**

- **After deploy:** New instances or a new cache layer start empty. Without warming, the first burst of traffic causes a spike and high latency.
- **Scheduled or predictable traffic:** You know traffic will spike at 9 a.m. Warm the important keys before that.

**How it works:** A job or script runs after deploy (or on a schedule) and issues requests for the hot keys, or loads data and writes to cache. By the time users arrive, the cache already has those entries.

**What you warm:** The set of keys you know will be hot. Sometimes derived from analytics or logs, sometimes a fixed list (e.g. homepage, top products, critical config).

**Tradeoff:** You do extra work before traffic starts. In return, first requests are fast and you avoid a cold-start spike.

<!-- IMAGE: Timeline – "before traffic" or "post-deploy" phase with cache being filled (keys/entries); then traffic arrives and hits warm cache. Path: /blog/system-design/caching-warming.png -->

## Tradeoffs: Freshness, Latency, and Consistency

No strategy gives you everything. In practice you're balancing three things:

- **Freshness:** how up-to-date the data is. More freshness usually means shorter TTLs, more refills, and more backend load.
- **Latency:** how fast users get a response. Lower latency often means serving from cache (and accepting some staleness) instead of waiting on the backend.
- **Consistency:** whether everyone sees the same view. Strong consistency (everyone always sees the latest write) is costly with caches; you often settle for eventual consistency or per-key guarantees.

In short: more freshness → more backend load; lower latency → often accept staleness; strong consistency → expensive. Pick the tradeoffs that match your product (e.g. read-heavy UI vs. pricing/inventory).

<!-- IMAGE: Triangle or 3-axis sketch – freshness vs latency vs consistency (or cost); or simple 2x2 "strategy vs tradeoff" matrix. Path: /blog/system-design/caching-tradeoffs-triangle.png -->

## When to Use Which Strategy

A quick guide:

- **High traffic, same hot key** → use **jitter** (spread expiry) plus **mutex** (one request refills). Together they avoid the thundering herd.
- **Read-heavy, user-facing** (feeds, dashboards) → **SWR**. Fast response, eventually fresh, no blocking.
- **Cold start or after deploy** → **cache warming**. Pre-fill hot keys so the first requests don't all miss.
- **Want to smooth load before expiry** (many keys, same TTL) → **probability-based early expiration**. Spread refills over the window.

When in doubt, ask: what happens at expiry? Who refills? What do users see? Then pick the strategy that fixes the worst of those.

<!-- IMAGE: Decision flowchart or table – "High traffic? Same key? → jitter + mutex"; "Read-heavy UI? → SWR"; "Cold start? → warming". Path: /blog/system-design/caching-strategy-decision.png -->

## Key Takeaways

- **TTL alone causes spikes:** same expiry time means everyone misses together and stampedes the backend.
- **Jitter, mutex, SWR, and warming** each fix different parts of the problem: jitter spreads expiry; mutex ensures only one refill per key; SWR keeps latency low and avoids blocking; warming avoids cold-start spikes.
- **Choose by tradeoffs:** freshness vs. latency vs. backend load. There's no free lunch.
- **Always ask:** What happens at expiry? Who refills? What do users see? Design for that.
