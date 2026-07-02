# Balancing fixes – enemies

Cíl: opravit nechtěné poškození hráče při dashi skrz brute a shielder-zezadu, mírně zpomalit archera a upravit AOE bombera.

## 1. Brute & Shielder – neubírat HP během dashe

**Root cause:** V `src/routes/play.tsx` (~ř. 925–934) je „melee on touch" kontrola, která se spouští v real-time (což zahrnuje i `player.dashing`). Když hráč projede skrz brute (2 HP) nebo shielder zezadu (3 HP), enemy přežije a při průchodu se aktivuje melee dotyk → -1 HP.

**Fix:** Dash je útok a má fungovat jako i-frame. Podmínku upravit tak, aby melee damage od nepřítele NEplatila, když hráč právě dashuje:

```
if (
  !s.player.dashing &&              // ← nově: během dashe žádný melee
  s.player.invuln <= 0 &&
  e.type !== "archer" && e.type !== "bomber" &&
  d < enemyRadius(e.type) + PLAYER_R - 2
) { ... }
```

Tím se vyřeší obojí:
- Brute: první dash ho zraní (2→1), druhý zabije, aniž by hráč cokoli schytal.
- Shielder: dash zezadu prochází bez damage; frontální blok zůstává beze změny (spark + zastavení dashe).
- Grunt/Boss chování se nemění (grunt umře na první hit; boss má vlastní i-frames).

Melee damage se nadále aplikuje, když nepřítel dojde k stojícímu hráči během aim/slow-mo fáze.

## 2. Archer – lehce pomalejší střelba

V `mkEnemy` (ř. 645) a v místě, kde se `shootCd` resetuje po výstřelu, zvýšit cooldown ~o 25 %:

- Init: `1200 + Math.random() * 800`  →  `1600 + Math.random() * 900`
- Reset po výstřelu (najít v archer AI bloku): stejné navýšení (`~1600–2500 ms` místo dosavadní hodnoty).

Rychlost šípu, dostřel ani detection range se nemění.

## 3. Bomber – zmenšit AOE

Bomber vybuchuje na dvou místech se stejným radiusem:
- Proximity fuse explosion (v enemy update, hledat `explodeAt` volané pro bombera).
- Death explosion po zabití dashem (ř. 762: `explodeAt(s, e.pos, 78, true)` – už je 78).

Změnit oba radiusy na **78 px** (proximity nyní 110 → 78; death už je 78, ponechat).

Vizuální „danger ring" u bombera zmenšit odpovídajícím způsobem, ať telegraf odpovídá skutečnému AOE.

## Beze změny
- Grunt – OK.
- Boss (Warlord) – OK.
- Trajektorie, slow-mo, HUD, level layouty.

## Files touched
- `src/routes/play.tsx` (jediný soubor)
