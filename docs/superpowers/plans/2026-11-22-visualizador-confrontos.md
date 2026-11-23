# Visualizador de Confrontos — Major CS2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página HTML única que roda Monte Carlo da fase suíça do Major e mostra, por par de times, a probabilidade de se enfrentarem — respeitando as regras reais de pareamento.

**Architecture:** Motor puro em `engine.js` (testável no Node) que simula um stage suíço de 16 times com pareamento por seed/Buchholz e regra de sem-revanche. Monte Carlo por cima agrega P(confronto) numa matriz 16×16. `index.html` fornece a UI (inputs, mapa de calor, travar resultados ao vivo). Build final inlina `engine.js` em `index.html` para distribuir um arquivo só.

**Tech Stack:** JavaScript puro (sem framework, sem build tool). Testes com `node:test`/`node:assert`. RNG determinístico (mulberry32) para testes reprodutíveis.

**Spec:** `/home/matheus-martins/Documentos/Major/design.md`

## Global Constraints

- Um deliverable final: `index.html` autossuficiente, abre de `file://`, sem backend, sem rede em uso.
- Sem dependências de runtime; Node só para rodar testes.
- Simulação de N sims deve rodar em < ~1s no navegador (N default 200000).
- Dois inputs separados: **seed** (estrutura/pareamento/Buchholz) e **força** (quem ganha). Não assumir que têm a mesma ordem.
- Rodada 1: pareamento seed N vs N+8 (1×9…8×16) — caso particular da regra geral abaixo.
- Rodadas ≥2: agrupar por record; ordenar o grupo por Buchholz (desc), desempate seed (asc); parear **metade de cima vs metade de baixo** (rank k vs rank k+n/2); **sem revanche**.
- MD3 (Bo3) quando a partida é decisiva (algum dos dois com 2 vitórias ou 2 derrotas); senão MD1.

## Review Focus

- **Pareamento que geraria revanche:** o desvio de sem-revanche precisa reparear sem criar outra revanche — Task 2 e Task 5 (validação contra bracket real) cobrem.
- **Resultados travados que esvaziam um ramo:** com resultados fixos, grupos podem ter tamanho ímpar/pares já decididos; a simulação não pode parear time já avançado/eliminado — Task 3.
- **Par que nunca se encontra:** célula 0 na matriz deve ser mostrada como "não se enfrentam em nenhum cenário", não como dado faltando — Task 6.
- **Força igual (empate de rating):** `mapWinProb` deve dar 0.5 e não dividir por zero no knob de zebra — Task 1.
- **N baixo / reprodutibilidade:** com `seed` fixa o resultado do Monte Carlo é idêntico entre execuções — Task 4.

---

### Task 1: Modelo de probabilidade de partida

**Files:**
- Create: `engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Produces: `mapWinProb(strengthA: number, strengthB: number, upset: number) -> number` (0..1); `bo3WinProb(p: number) -> number`.

- [ ] **Step 1: Write failing tests**

```js
test('mapWinProb: força igual => 0.5', () => {
  assert.equal(mapWinProb(1000, 1000, 400), 0.5);
});
test('mapWinProb: favorito > 0.5 e cresce com a vantagem', () => {
  assert.ok(mapWinProb(1200, 1000, 400) > 0.5);
  assert.ok(mapWinProb(1400, 1000, 400) > mapWinProb(1200, 1000, 400));
});
test('mapWinProb: upset maior aproxima de 0.5', () => {
  assert.ok(Math.abs(mapWinProb(1400,1000,800)-0.5) < Math.abs(mapWinProb(1400,1000,200)-0.5));
});
test('bo3WinProb: favorito de mapa fica mais favorito em Bo3', () => {
  assert.ok(bo3WinProb(0.6) > 0.6);
  assert.equal(bo3WinProb(0.5), 0.5);
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `node --test`
Expected: FAIL (funções indefinidas)

- [ ] **Step 3: Implement**

`mapWinProb` = logística `1/(1+exp(-(sA-sB)/upset))`. `bo3WinProb(p)` = `p*p*(3-2*p)`. Exportar via `module.exports` e também em `globalThis` para o browser.

- [ ] **Step 4: Run tests, verify pass** — Run: `node --test` / Expected: PASS

- [ ] **Step 5: Commit** — `git init` se preciso; `git add engine.js test/engine.test.js && git commit -m "feat: match probability model"`

---

### Task 2: Pareamento de um grupo (o núcleo de corretude)

**Files:**
- Modify: `engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: estrutura de time `{id, seed}` e acumuladores de record por time.
- Produces: `buchholz(teamId, state) -> number`; `seedGroup(groupIds, state) -> id[]` (ordenado Buchholz desc, seed asc); `pairGroup(sortedIds, hasPlayed) -> [idA,idB][]` onde `hasPlayed(a,b)->bool`, pareando rank k vs rank k+n/2 com desvio de sem-revanche.

- [ ] **Step 1: Write failing tests**

```js
test('seedGroup: ordena por Buchholz desc, depois seed asc', () => { /* 4 times, bucholz conhecido => ordem esperada */ });
test('pairGroup R1-like: 16 ordenados por seed => 1x9..8x16', () => {
  const pairs = pairGroup(ids1to16, () => false);
  assert.deepEqual(pairs.map(p=>[p[0],p[1]]), [[1,9],[2,10],[3,11],[4,12],[5,13],[6,14],[7,15],[8,16]]);
});
test('pairGroup: metade-vs-metade em grupo de 4 => rank1x3, rank2x4', () => {
  assert.deepEqual(pairGroup([10,20,30,40], ()=>false), [[10,30],[20,40]]);
});
test('pairGroup: evita revanche deslocando o par', () => {
  // 10 já jogou com 30 => não pode repetir; par deve desviar sem criar nova revanche
  const hp = (a,b)=> (a===10&&b===30)||(a===30&&b===10);
  const pairs = pairGroup([10,20,30,40], hp);
  assert.ok(!pairs.some(([a,b]) => (a===10&&b===30)||(a===30&&b===10)));
});
```

- [ ] **Step 2: Run, verify fail** — `node --test`

- [ ] **Step 3: Implement** — `buchholz` soma `(wins-losses)` dos adversários já enfrentados. `pairGroup`: pareia `sorted[k]` com `sorted[k+n/2]`; se `hasPlayed`, troca o time da metade de baixo pelo próximo candidato que não gere revanche. Procedimento exato de desvio da Valve fica travado na Task 5; aqui vale a heurística "próximo mais próximo em seed sem revanche".

- [ ] **Step 4: Run, verify pass** — `node --test`

- [ ] **Step 5: Commit** — `feat: swiss group pairing with no-rematch`

---

### Task 3: Simulação de um stage

**Files:**
- Modify: `engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `pairGroup`, `seedGroup`.
- Produces: `simulateStage(teams, {resolve, locked}) -> {matchups: [idA,idB][], standings: Map<id,{wins,losses,result:'advance'|'eliminate'}>}`. `teams`: `[{id,seed,strength}]`. `resolve(idA,idB,isBo3)->winnerId`. `locked`: `Map<pairKey, winnerId>` (pares já decididos ao vivo). `isBo3` = algum dos dois com 2 vitórias ou 2 derrotas. `pairKey(a,b)` = par não-ordenado.

- [ ] **Step 1: Write failing tests**

```js
test('simulateStage: resolve determinístico (sempre vence o de menor id) => 8 avançam, 8 eliminam', () => {
  const r = simulateStage(teams16, {resolve:(a,b)=>Math.min(a,b), locked:new Map()});
  const adv = [...r.standings.values()].filter(s=>s.result==='advance');
  assert.equal(adv.length, 8);
});
test('simulateStage: ninguém joga duas vezes com o mesmo', () => { /* varre matchups, sem par repetido */ });
test('simulateStage: resultado travado é respeitado', () => {
  const locked = new Map([[pairKey(1,9), 9]]); // zebra fixada
  const r = simulateStage(teams16, {resolve:(a,b)=>Math.min(a,b), locked});
  assert.equal(r.standings.get(9).wins >= 1, true);
});
test('simulateStage: todo time termina em 3 vitórias ou 3 derrotas', () => { /* standings */ });
```

- [ ] **Step 2: Run, verify fail** — `node --test`

- [ ] **Step 3: Implement** — Laço de rodadas: enquanto houver time ativo (<3W e <3L), agrupar ativos por `(wins,losses)`, `seedGroup` cada grupo, `pairGroup` com `hasPlayed` global, resolver cada par (usar `locked` se presente, senão `resolve`), atualizar wins/losses e adversários. Registrar cada par em `matchups`.

- [ ] **Step 4: Run, verify pass** — `node --test`

- [ ] **Step 5: Commit** — `feat: single swiss stage simulation`

---

### Task 4: Agregação Monte Carlo

**Files:**
- Modify: `engine.js`
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `simulateStage`, `mapWinProb`, `bo3WinProb`.
- Produces: `mulberry32(seed)->()=>number`; `runMonteCarlo(teams, {N, upset, locked, seed, probOverride}) -> {meetProb: number[][], advanceProb: Map, threeZero: Map, zeroThree: Map, n}` onde `meetProb[i][j]` = fração de sims em que os times de índice i e j se enfrentaram. `probOverride`: `Map<pairKey, number>` opcional — quando presente para um par, `resolve` usa essa P(menor id vence) em vez da calculada por `mapWinProb`.

- [ ] **Step 1: Write failing tests**

```js
test('runMonteCarlo: mesma seed => resultado idêntico', () => {
  const a = runMonteCarlo(teams16,{N:2000,upset:400,locked:new Map(),seed:1});
  const b = runMonteCarlo(teams16,{N:2000,upset:400,locked:new Map(),seed:1});
  assert.deepEqual(a.meetProb, b.meetProb);
});
test('runMonteCarlo: meetProb simétrica e diagonal zero', () => { /* [i][j]==[j][i], [i][i]==0 */ });
test('runMonteCarlo: R1 fixa por seed => P(1 enfrenta 9) == 1', () => {
  const r = runMonteCarlo(teams16,{N:1000,upset:400,locked:new Map(),seed:7});
  assert.equal(r.meetProb[idx(1)][idx(9)], 1);
});
test('runMonteCarlo: probabilidades em [0,1] e advanceProb soma ~8', () => { /* soma das P(avança) ≈ 8 */ });
```

- [ ] **Step 2: Run, verify fail** — `node --test`

- [ ] **Step 3: Implement** — `resolve` interno sorteia com `rng() < winProb` (Bo3 transform quando `isBo3`); laço N vezes acumulando contagens; dividir por N.

- [ ] **Step 4: Run, verify pass** — `node --test`

- [ ] **Step 5: Commit** — `feat: monte carlo aggregation`

---

### Task 5: Validação contra bracket real do majors.im (gate de corretude)

**Files:**
- Create: `test/fixtures/real-stage.json` (seeds + resultados reais rodada a rodada + pareamentos reais de um stage suíço de 16 times já concluído)
- Test: `test/validation.test.js`

**Interfaces:**
- Consumes: `simulateStage` com `locked` = todos os resultados reais.

- [ ] **Step 1: Levantar os dados reais** — Buscar em majors.im (ou HLTV) um stage suíço de 16 times já concluído: seeds iniciais, e para cada rodada os confrontos reais e vencedores. Salvar em `real-stage.json`. (WebFetch na execução.)

- [ ] **Step 2: Write failing test**

```js
test('engine reproduz os pareamentos reais de cada rodada dado os resultados reais', () => {
  const r = simulateStage(realTeams, {resolve:()=>{throw 'tudo deveria estar travado'}, locked: realResults});
  // comparar r.matchups por rodada com os pareamentos reais do fixture
  assert.deepEqual(normalize(r.matchups), normalize(realPairings));
});
```

- [ ] **Step 3: Run, verify fail se o pareamento divergir** — `node --test`

- [ ] **Step 4: Ajustar `seedGroup`/`pairGroup` (desvio de revanche, ordem de Buchholz) até bater exatamente.** Esta é a tarefa que pode exigir iteração; o critério de pronto é o fixture real reproduzido 100%.

- [ ] **Step 5: Commit** — `test: validate pairing against real major bracket`

---

### Task 6: UI — página HTML

**Files:**
- Create: `index.html` (carrega `engine.js` via `<script src>` durante o dev)

**Interfaces:**
- Consumes: `runMonteCarlo`, `pairKey`.

- [ ] **Step 1: Tabela de times editável** — 16 linhas: nome, seed, força. Default: 16 times de exemplo editáveis. Botão "rodar".
- [ ] **Step 2: Controles** — campo N (default 200000), slider de knob de zebra (upset), seed de RNG opcional.
- [ ] **Step 3: Mapa de calor 16×16** — células coloridas por `meetProb`; mostrar % ao passar/tocar; célula 0 marcada como "não se enfrentam em nenhum cenário"; diagonal neutra.
- [ ] **Step 4: Painel ao vivo** — mostra os confrontos da rodada atual (derivados dos resultados já travados) e deixa clicar o vencedor de cada um; ao travar, re-roda e tudo recalcula.
- [ ] **Step 5: Leitura secundária** — por time selecionado, lista de adversários ordenada por probabilidade; e P(3-0)/P(0-3)/P(avança).
- [ ] **Step 6: Override de confronto** — campo opcional para fixar na mão a P de um confronto específico (alimenta `probOverride`); re-roda ao aplicar.
- [ ] **Step 7: Verificação manual** — abrir `index.html` no navegador, rodar, conferir que R1 mostra 100% nos pares de seed e que travar um resultado muda o mapa. Relatar o que foi testado de fato na UI.
- [ ] **Step 8: Commit** — `feat: matchup matrix UI`

---

### Task 7: Build de arquivo único

**Files:**
- Modify: `index.html` (inlinar `engine.js`)

- [ ] **Step 1: Inlinar** — substituir `<script src="engine.js">` pelo conteúdo de `engine.js` dentro de `<script>…</script>`, gerando um `index.html` autossuficiente que abre de `file://`.
- [ ] **Step 2: Verificação** — abrir o `index.html` final direto do disco (sem servidor), confirmar que roda.
- [ ] **Step 3: Commit** — `build: single-file index.html`
